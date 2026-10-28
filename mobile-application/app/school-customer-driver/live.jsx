import { DriverLiveScreen } from "../../src/components/DriverLiveScreen";

export default function SchoolCustomerDriverLive() {
  return (
    <DriverLiveScreen
      variant="corporate"
      liveHref="/school-customer-driver/live"
      tripsHref="/school-customer-driver/home"
    />
  );
}
