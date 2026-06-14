import type { Metadata } from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/features/auth/context/AuthContext';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const robotoMono = Roboto_Mono({ variable: '--font-roboto-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'id — Universal Login',
  description: 'Internal OpenID Connect provider',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${robotoMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
