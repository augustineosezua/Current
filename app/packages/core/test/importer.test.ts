import { describe, expect, it } from "vitest";
import { importSpan, parseBankDate, parseBankFile, parseCsv, skipExisting } from "../src";
import { d, txn, ymd } from "./helpers";

const simple = (r: { date: Date; amount: number; merchantName: string }) => [ymd(r.date), r.amount, r.merchantName];

describe("2.5 import: CSV basics", () => {
  it("handles quotes, commas inside quotes and CRLF", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3\r\n')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });

  it.each([
    ["2027-01-05", "2027-01-05"],
    ["20270105", "2027-01-05"],
    ["1/5/2027", "2027-01-05"],
    ["01/05/27", "2027-01-05"],
    ["20270105120000[-5:EST]", "2027-01-05"],
    ["2/30/2027", null],
    ["Jan 5", null],
  ])("date %s -> %s", (input, out) => {
    expect(ymd(parseBankDate(input))).toBe(out);
  });
});

describe("2.5 import: Canadian banks", () => {
  it("TD: no header, date, description, debit, credit, balance", () => {
    const r = parseBankFile("01/05/2027,TIM HORTONS #123,4.50,,1000.00\n01/06/2027,PAYROLL,,800.00,1795.50\n")!;
    expect(r.format).toBe("td");
    expect(r.rows.map(simple)).toEqual([
      ["2027-01-05", 450, "TIM HORTONS #123"],
      ["2027-01-06", -80_000, "PAYROLL"],
    ]);
  });

  it("CIBC: no header, ISO dates", () => {
    const r = parseBankFile("2027-01-05,PRESTO FARE,3.30,\n2027-01-07,E-TRANSFER,,25.00\n")!;
    expect(r.format).toBe("cibc");
    expect(r.rows.map(simple)).toEqual([
      ["2027-01-05", 330, "PRESTO FARE"],
      ["2027-01-07", -2_500, "E-TRANSFER"],
    ]);
  });

  it("RBC: header row, signed CAD$ column", () => {
    const csv =
      '"Account Type","Account Number","Transaction Date","Cheque Number","Description 1","Description 2","CAD$","USD$"\n' +
      'Chequing,01234-5678,1/5/2027,,"LOBLAWS 1234",,-56.78,\n' +
      "Chequing,01234-5678,1/8/2027,,PAYROLL DEPOSIT,ACME,1200.00,\n";
    const r = parseBankFile(csv)!;
    expect(r.format).toBe("rbc");
    expect(r.rows.map(simple)).toEqual([
      ["2027-01-05", 5_678, "LOBLAWS 1234"],
      ["2027-01-08", -120_000, "PAYROLL DEPOSIT"],
    ]);
  });

  it("BMO: preamble lines, then header, YYYYMMDD dates", () => {
    const csv =
      "Following data is valid as of 20270110\n\n" +
      "First Bank Card,Transaction Type,Date Posted, Transaction Amount,Description\n" +
      "'500766',DEBIT,20270105,-12.00,[CW]UBER TRIP\n" +
      "'500766',CREDIT,20270106,50.00,[DN]REFUND\n";
    const r = parseBankFile(csv)!;
    expect(r.format).toBe("bmo");
    expect(r.rows.map(simple)).toEqual([
      ["2027-01-05", 1_200, "[CW]UBER TRIP"],
      ["2027-01-06", -5_000, "[DN]REFUND"],
    ]);
  });

  it("Scotiabank: current export with a header", () => {
    const csv =
      "Filter,Date,Description,Sub-description,Status,Type of Transaction,Amount\n" +
      ",2027-01-05,Point of Sale,STARBUCKS,posted,Debit,6.25\n" +
      ",2027-01-06,Deposit,PAYROLL,posted,Credit,900.00\n";
    const r = parseBankFile(csv)!;
    expect(r.format).toBe("scotiabank");
    expect(r.rows.map(simple)).toEqual([
      ["2027-01-05", 625, "Point of Sale STARBUCKS"],
      ["2027-01-06", -90_000, "Deposit PAYROLL"],
    ]);
  });

  it("Scotiabank: older headerless export", () => {
    const r = parseBankFile('1/5/2027,-6.25,-,POS PURCHASE,STARBUCKS\n1/6/2027,900.00,-,DEPOSIT,PAYROLL\n')!;
    expect(r.format).toBe("scotiabank");
    expect(r.rows.map(simple)).toEqual([
      ["2027-01-05", 625, "STARBUCKS"],
      ["2027-01-06", -90_000, "PAYROLL"],
    ]);
  });

  it("any export with date, description and amount headers", () => {
    const r = parseBankFile("Date,Description,Amount\n2027-01-05,Coffee,-4.00\n2027-01-05,bad row,\n")!;
    expect(r.format).toBe("generic");
    expect(r.rows.map(simple)).toEqual([["2027-01-05", 400, "Coffee"]]);
    expect(r.skipped).toBe(1);
  });

  it("OFX/QFX: one transaction per STMTTRN block", () => {
    const ofx =
      "OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>\n" +
      "<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20270105120000[-5:EST]<TRNAMT>-4.50<FITID>1<NAME>TIM HORTONS\n" +
      "<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20270106<TRNAMT>800.00<FITID>2<MEMO>PAYROLL</MEMO></STMTTRN>\n" +
      "</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>";
    const r = parseBankFile(ofx, "statement.qfx")!;
    expect(r.format).toBe("ofx");
    expect(r.rows.map(simple)).toEqual([
      ["2027-01-05", 450, "TIM HORTONS"],
      ["2027-01-06", -80_000, "PAYROLL"],
    ]);
  });

  it("returns null for a file it can't read", () => {
    expect(parseBankFile("hello\nworld\n")).toBeNull();
  });
});

describe("2.5 import: duplicates", () => {
  it("skips rows matching an existing entry on date, amount and merchant, one for one", () => {
    const rows = [
      { date: d(2027, 1, 5), amount: 450, merchantName: "TIM HORTONS" },
      { date: d(2027, 1, 5), amount: 450, merchantName: "Tim Hortons" },
      { date: d(2027, 1, 6), amount: 450, merchantName: "Tim Hortons" },
    ];
    const existing = [txn({ date: d(2027, 1, 5), amount: 450, merchantName: "Tim Hortons!" })];
    const r = skipExisting(rows, existing);
    expect(r.duplicates).toBe(1);
    expect(r.fresh).toHaveLength(2);
  });

  it("reports the span of an import", () => {
    const span = importSpan([
      { date: d(2027, 1, 9), amount: 1, merchantName: "a" },
      { date: d(2027, 1, 2), amount: 1, merchantName: "b" },
    ]);
    expect([ymd(span!.from), ymd(span!.to)]).toEqual(["2027-01-02", "2027-01-09"]);
  });
});
