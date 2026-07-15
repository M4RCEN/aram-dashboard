import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
     title: "ARAM Dashboard",
     description: "PostgREST Database Dashboard",
};

export default function RootLayout({
     children,
}: {
     children: React.ReactNode;
}) {
     return (
          <html lang="en">
               <body className={`${inter.variable} font-sans antialiased bg-slate-50 text-slate-900`}>
                    {children}
               </body>
          </html>
     );
}