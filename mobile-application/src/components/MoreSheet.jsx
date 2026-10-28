import { MenuSheet } from "./MenuSheet";

const ITEMS = [
  { icon: "notifications-outline", title: "Alerts", subtitle: "Manage your notifications", href: "/notifications" },
  { icon: "bookmark-outline", title: "Saved Routes", subtitle: "Routes you bookmarked", href: "/saved-routes" },
  { icon: "time-outline", title: "Travel History", subtitle: "View your past trips", href: "/travel-history" },
  { icon: "calendar-outline", title: "Subscriptions", subtitle: "Manage your subscriptions", href: "/subscriptions" },
  { icon: "chatbox-ellipses-outline", title: "Route Requests", subtitle: "Request new routes", href: "/route-requests" },
  { icon: "person-outline", title: "Profile", subtitle: "Your account details", href: "/profile" },
  { icon: "settings-outline", title: "Settings", subtitle: "App preferences & security", href: "/settings" },
];

export function MoreSheet({ visible, onClose }) {
  return <MenuSheet visible={visible} onClose={onClose} items={ITEMS} />;
}
