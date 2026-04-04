import { Dot } from "lucide-react";

export default function Account({ account }: { account: any }) {
  const sortingAlgo = () => {
    // Sort accounts by balance in descending order
    const savings = account.filter(
      (acc: any) => acc.accountSubType === "savings",
    );
    const spendings = account.filter(
      (acc: any) => acc.accountSubType === "checking",
    );

    const sortedSavings = savings.sort(
      (a: any, b: any) => b.balance - a.currentBalance,
    );
    const sortedSpendings = spendings.sort(
      (a: any, b: any) => b.balance - a.currentBalance,
    );

    return [sortedSpendings[0], sortedSavings[0]];
  };

  const mainAccounts = sortingAlgo();

  return (
    <div className="flex justify-between w-full h-32 gap-4 text-white">
      {mainAccounts.map((acc: any) => (
        <div
          className=" flex justify-between bg-[#16213E] p-4 rounded-2xl w-full hover:cursor-pointer"
          key={acc.plaidAccountId}
        >
          <div className="flex flex-col justify-between items-start">
            <h3 className="text-white/80">{acc.accountName}</h3>
            <p className="text-[#5EB3FF]/80 text-4xl">${acc.currentBalance}</p>
            <p className="text-xs text-white/80">
              {acc.institutionName.slice(0, 15)}
            </p>
          </div>
          <div>
            {" "}
            {acc.accountSubType === "savings" ? (
              <div className="flex flex-col items-end justify-between h-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 4 4"
                  fill="none"
                  stroke={"#3ecf8e"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={"shrink-0 drop-shadow-[0_0_6px_#3ecf8e]"}
                >
                  <circle cx="2" cy="2" r="1" />
                </svg>
              </div>
            ) : (
              <div className="flex flex-col items-end justify-between h-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 4 4"
                  fill="none"
                  stroke="#5EB3FF"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={"shrink-0 drop-shadow-[0_0_6px_#5EB3FF]"}
                >
                  <circle cx="2" cy="2" r="1" />
                </svg>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
