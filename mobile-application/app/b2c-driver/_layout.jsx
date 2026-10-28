import { RoleTabs } from "../../src/components/RoleTabs";
import { ROLES } from "../../src/utils/roles";

const TABS = [
  { name: "home", title: "Home", active: "home", inactive: "home-outline" },
  { name: "trips", title: "Daily Trips", active: "bus", inactive: "bus-outline" },
  { name: "ratings", title: "My Ratings", active: "star", inactive: "star-outline" },
  { name: "live", title: "Live Location", active: "location", inactive: "location-outline" },
];

export default function B2CDriverLayout() {
  return <RoleTabs role={ROLES.B2C_PARTNER_DRIVER} tabs={TABS} hidden={["account"]} />;
}
