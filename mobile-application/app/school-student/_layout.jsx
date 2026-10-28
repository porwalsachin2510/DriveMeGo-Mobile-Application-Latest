import { RoleTabs } from "../../src/components/RoleTabs";
import { ROLES } from "../../src/utils/roles";

const TABS = [
  { name: "home", title: "Home", active: "home", inactive: "home-outline" },
  { name: "history", title: "Trip History", active: "calendar", inactive: "calendar-outline" },
  { name: "transport", title: "Transport Info", active: "bus", inactive: "bus-outline" },
];

export default function SchoolStudentLayout() {
  return <RoleTabs role={ROLES.SCHOOL_STUDENT} tabs={TABS} hidden={["account", "live", "feedback", "route-change", "sos", "no-shows"]} />;
}
