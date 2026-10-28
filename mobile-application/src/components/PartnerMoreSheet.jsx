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
];

export function PartnerMoreSheet({ visible, onClose }) {
  return <MenuSheet visible={visible} onClose={onClose} items={ITEMS} />;
}
