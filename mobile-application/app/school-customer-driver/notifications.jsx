import { NotificationsPanel } from "../../src/components/NotificationsPanel";

export default function SchoolCustomerDriverNotifications() {
  return (
    <NotificationsPanel
      withFilters
      liveHref="/school-customer-driver/live"
      subtitle="Stay up to date with your trips and account"
    />
  );
}
