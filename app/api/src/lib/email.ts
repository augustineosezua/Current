import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_KEY);

export async function sendEmail(from: string, to: string, subject: string, html: string) {
  try {
    const {data, error} = await resend.emails.send({
        from: from,
        to: to,
        subject: subject,
        html: html
    })
    if(error){
        console.error("Error sending email:", error);
        return;
    }
    return data;
  } catch (error) {
    console.error("Error sending email:", error);
    return;
  }
}

export async function sendPasswordResetEmail(to: string, token: string) {
  
}