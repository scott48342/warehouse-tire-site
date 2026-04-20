import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Us | Warehouse Tire Direct',
  description: 'Contact Warehouse Tire Direct for questions about tires, wheels, fitment help, or order support. We\'re here to help!',
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
