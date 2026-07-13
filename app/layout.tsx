import "./globals.css";

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
               <body>{children}</body>
          </html>
     );
}