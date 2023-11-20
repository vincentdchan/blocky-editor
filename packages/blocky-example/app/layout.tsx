import React from "react";
import Script from "next/script";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blocky Editor Example",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-PS6NK1TQ06"
        ></Script>
        <Script>
          {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'G-PS6NK1TQ06');
    `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
