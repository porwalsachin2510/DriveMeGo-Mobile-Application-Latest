import { MenuSheet } from "./MenuSheet";

const ITEMS = [
  { icon: "calendar-outline", title: "Schedules", href: "/partner/schedules" },
  { icon: "car-sport-outline", title: "Fleet & Drivers", href: "/partner/fleet" },
  { icon: "wallet-outline", title: "Earnings", href: "/partner/earnings" },
  { icon: "chatbox-ellipses-outline", title: "Route Requests", href: "/partner/requests" },
  { icon: "star-outline", title: "My Ratings", href: "/partner/ratings" },
  { icon: "pricetag-outline", title: "My Commission", href: "/partner/commission" },
  { icon: "business-outline", title: "Settlements", href: "/partner/settlements" },
  { icon: "person-circle-outline", title: "Account", href: "/partner/account" },
  { icon: "document-text-outline", title: "Terms & Conditions", href: "/page/terms-and-conditions" },
  { icon: "shield-checkmark-outline", title: "Privacy Policy", href: "/page/privacy-policy" },
  { icon: "information-circle-outline", title: "About Us", href: "/page/about-us" },
  { icon: "mail-outline", title: "Contact Us", href: "/page/contact-us" },
];

export function PartnerMoreSheet({ visible, onClose }) {
  return <MenuSheet visible={visible} onClose={onClose} items={ITEMS} />;
}
