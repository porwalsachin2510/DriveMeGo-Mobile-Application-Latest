import { RoleTabs } from "../../src/components/RoleTabs";
import { ROLES } from "../../src/utils/roles";

const TABS = [
  { name: "home", title: "Home", active: "home", inactive: "home-outline" },
  { name: "notifications", title: "Notifications", active: "notifications", inactive: "notifications-outline" },
  { name: "live", title: "Live Location", active: "location", inactive: "location-outline" },
];

export default function SchoolPartnerDriverLayout() {
  return <RoleTabs role={ROLES.SCHOOL_PARTNER_DRIVER} tabs={TABS} hidden={["account"]} />;
}
