const period = `
Pay Period Begin 09/14/2026
Pay Period End 09/20/2026
Check Date 09/25/2026
`;

export const workdayPaycheckTextFixtures = {
  ordinarySingleRate: `${period}
REGULAR 40.00 33.15 1,326.00
Gross Cash Pay 1,326.00
Employee Taxes 326.00
Net Pay 1,000.00
`,
  multipleRegularRowsSameRate: `${period}
REGULAR 09/14/2026 - 09/16/2026 24.00 33.15 795.60
REGULAR 09/17/2026 - 09/20/2026 16.00 33.15 530.40
Gross Cash Pay 1,326.00
Employee Taxes 326.00
Net Pay 1,000.00
`,
  multipleRegularRowsDifferentRatesWithDates: `${period}
REGULAR 09/14/2026 - 09/16/2026 24.00 33.15 795.60
REGULAR 09/17/2026 - 09/20/2026 16.00 35.25 564.00
Gross Cash Pay 1,359.60
Employee Taxes 359.60
Net Pay 1,000.00
`,
  multipleRegularRowsDifferentRatesWithoutDates: `${period}
REGULAR 24.00 33.15 795.60
REGULAR 16.00 35.25 564.00
Gross Cash Pay 1,359.60
Employee Taxes 359.60
Net Pay 1,000.00
`,
  missingRate: `${period}
REGULAR 40.00 1,326.00
Gross Cash Pay 1,326.00
Employee Taxes 326.00
Net Pay 1,000.00
`,
  missingRegularEarnings: `${period}
REGULAR 40.00 33.15
Gross Cash Pay 1,326.00
Employee Taxes 326.00
Net Pay 1,000.00
`,
  rateEarningsMismatch: `${period}
REGULAR 40.00 33.15 1,300.00
Gross Cash Pay 1,300.00
Employee Taxes 300.00
Net Pay 1,000.00
`,
  zeroHourRegularRow: `${period}
REGULAR 0.00 33.15 0.00
Gross Cash Pay 0.00
Net Pay 0.00
`,
  adjustmentOnly: `${period}
Adjustment Payment 125.00
Gross Cash Pay 125.00
Employee Taxes 25.00
Net Pay 100.00
`,
  currentYtdAmbiguity: `${period}
Earnings Hours Rate Current YTD
REGULAR 40.00 33.15 38,480.60
Gross Cash Pay 1,326.00
Employee Taxes 326.00
Net Pay 1,000.00
`,
  splitOvertime: `${period}
REGULAR 40.00 33.15 1,326.00
Overtime 1X 20.00 33.15 663.00
Overtime Premium - 0.5X 20.00 16.575 331.50
Gross Cash Pay 2,320.50
Employee Taxes 520.50
Net Pay 1,800.00
`,
  unfamiliarAmbiguousColumns: `${period}
REGULAR 40.00 33.15 1,326.00 400.00 38,480.60
Gross Cash Pay 1,326.00
Employee Taxes 326.00
Net Pay 1,000.00
`,
  realisticCurrentAndYtd: `
Pay Period Begin Pay Period End Check Date
09/21/2026 09/27/2026 10/02/2026
Earnings Work Dates Hours Rate Current YTD
Imputed GTL 09/21/2026 - 09/27/2026 0.00 0.00 1.15 101.15
Imputed LTD 09/21/2026 - 09/27/2026 0.00 0.00 9.16 209.16
Overtime 1X 09/21/2026 - 09/27/2026 20.00 33.15 663.00 29,016.63
Overtime Premium - 0.5X 09/21/2026 - 09/27/2026 20.00 16.575 331.50 14,550.62
REGULAR 09/21/2026 - 09/27/2026 40.00 33.15 1,326.00 38,480.60
`,
} as const;

export const realisticWorkdayLayout = {
  tables: [
    [
      ["Document", "Pay Period Begin", "Pay Period End", "Check Date"],
      ["Statement", "09/21/2026", "09/27/2026", "10/02/2026"],
    ],
    [
      ["Hours Worked", "Gross Pay", "Deductions", "Employee Taxes", "Net Pay"],
      ["60.00", "$2,320.50", "$121.04", "$520.00", "$1,679.46"],
    ],
  ],
};
