import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'PrintCraft Studio — Custom Couple Portraits',
  description:
    'Turn your couple photo into a custom caricature portrait printed on t-shirts, canvas, mugs, pillows and hoodies.',
  keywords: [
    'custom couple portrait',
    'caricature gift',
    'couples gift',
    'custom print',
    'anniversary gift',
    'boyfriend gift',
    'girlfriend gift',
  ],
  openGraph: {
    title: 'PrintCraft Studio',
    description: 'Custom couple caricature portraits on premium products.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-zinc-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}