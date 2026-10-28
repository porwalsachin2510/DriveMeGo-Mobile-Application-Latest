import { NotificationsPanel } from "../../src/components/NotificationsPanel";

export default function CorporateDriverNotifications() {
  return (
    <NotificationsPanel
      withFilters
      liveHref="/corp-driver/live"
      subtitle="Stay up to date with your trips and account"
    />
  );
}
