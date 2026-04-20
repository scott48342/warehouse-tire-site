export const BRAND = {
  name: "Warehouse Tire",
  phone: {
    callDisplay: "248-332-4120",
    callE164: "+12483324120",
    textDisplay: "248-499-0359",
    textE164: "+12484990359",
  },
  email: "support@warehousetiredirect.com",
  salesEmail: "sales@warehousetiredirect.com",
  links: {
    tel: "tel:+12483324120",
    sms: "sms:+12484990359",
    // WhatsApp uses E.164 without plus sign.
    whatsapp: "https://wa.me/12484990359",
    mailto: "mailto:support@warehousetiredirect.com",
  },
} as const;
