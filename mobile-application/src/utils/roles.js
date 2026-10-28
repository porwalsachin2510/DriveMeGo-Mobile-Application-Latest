export const ROLES = {
  COMMUTER: "COMMUTER",
  B2C_PARTNER: "B2C_PARTNER",
  B2C_PARTNER_DRIVER: "B2C_PARTNER_DRIVER",
  B2B_PARTNER_DRIVER: "B2B_PARTNER_DRIVER",
  CORPORATE_DRIVER: "CORPORATE_DRIVER",
  CORPORATE_EMPLOYEE: "CORPORATE_EMPLOYEE",
  SCHOOL_PARTNER_DRIVER: "SCHOOL_PARTNER_DRIVER",
  SCHOOL_CUSTOMER_DRIVER: "SCHOOL_CUSTOMER_DRIVER",
  SCHOOL_STUDENT: "SCHOOL_STUDENT",
};

export const ROLE_LABELS = {
  COMMUTER: "Commuter",
  B2C_PARTNER: "B2C Partner",
  B2C_PARTNER_DRIVER: "B2C Partner Driver",
  B2B_PARTNER_DRIVER: "B2B Partner Driver",
  CORPORATE_DRIVER: "Corporate Driver",
  CORPORATE_EMPLOYEE: "Corporate Employee",
  SCHOOL_PARTNER_DRIVER: "School Partner Driver",
  SCHOOL_CUSTOMER_DRIVER: "School Customer Driver",
  SCHOOL_STUDENT: "School Student",
};

export const isPartner = (user) => user?.role === ROLES.B2C_PARTNER;

export const HOME_BY_ROLE = {
  [ROLES.B2C_PARTNER]: "/partner/home",
  [ROLES.B2C_PARTNER_DRIVER]: "/b2c-driver/home",
  [ROLES.B2B_PARTNER_DRIVER]: "/b2b-driver/home",
  [ROLES.CORPORATE_DRIVER]: "/corp-driver/home",
  [ROLES.CORPORATE_EMPLOYEE]: "/employee/home",
  [ROLES.SCHOOL_PARTNER_DRIVER]: "/school-partner-driver/home",
  [ROLES.SCHOOL_CUSTOMER_DRIVER]: "/school-customer-driver/home",
  [ROLES.SCHOOL_STUDENT]: "/school-student/home",
};

export const ACCOUNT_BY_ROLE = {
  [ROLES.B2C_PARTNER_DRIVER]: "/b2c-driver/account",
  [ROLES.B2B_PARTNER_DRIVER]: "/b2b-driver/account",
  [ROLES.CORPORATE_DRIVER]: "/corp-driver/account",
  [ROLES.CORPORATE_EMPLOYEE]: "/employee/account",
  [ROLES.SCHOOL_PARTNER_DRIVER]: "/school-partner-driver/account",
  [ROLES.SCHOOL_CUSTOMER_DRIVER]: "/school-customer-driver/account",
  [ROLES.SCHOOL_STUDENT]: "/school-student/account",
};

export const isStaffRole = (user) => !!HOME_BY_ROLE[user?.role] && user.role !== ROLES.B2C_PARTNER;

export const homeHref = (user) => HOME_BY_ROLE[user?.role] || "/(tabs)";

const SCHOOL_ROLES = [ROLES.SCHOOL_PARTNER_DRIVER, ROLES.SCHOOL_CUSTOMER_DRIVER, ROLES.SCHOOL_STUDENT];

export const isSchoolRole = (role) => SCHOOL_ROLES.includes(role);

/**
 * Corporate and school roles share one managed-service pipeline. Screens read
 * their wording from here so a single component serves both segments.
 */
export const segmentTerms = (role) =>
  isSchoolRole(role)
    ? {
        segment: "school",
        organisation: "School",
        passenger: "Student",
        passengers: "Students",
        scheduledBy: "your school",
        driverLabel: "School Driver",
        driverTitle: role === ROLES.SCHOOL_PARTNER_DRIVER ? "School Partner Driver" : "School Customer Driver",
      }
    : {
        segment: "corporate",
        organisation: "Company",
        passenger: "Employee",
        passengers: "Employees",
        scheduledBy: "your company",
        driverLabel: "Corporate Driver",
        driverTitle: role === ROLES.B2B_PARTNER_DRIVER ? "B2B Partner Driver" : "Corporate Driver",
      };

/** Route inside the role's own tab group, e.g. rolePath(role, "live") -> "/school-student/live". */
export const rolePath = (role, screen = "home") => {
  const home = HOME_BY_ROLE[role] || "/(tabs)";
  return home.replace(/\/home$/, `/${screen}`);
};

/** Which booking API family a managed driver role uses. */
export const managedKindOf = (role) =>
  role === ROLES.B2B_PARTNER_DRIVER || role === ROLES.SCHOOL_PARTNER_DRIVER ? "b2b" : "corporate";
