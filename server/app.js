// The Express app: reads JSON request bodies, checks the admin password on admin routes,
// and adds every group of routes. Each route file in routes/ says what its URLs do.
import express from 'express'
import { adminOnlyRoutes } from './auth/accessRules.js'

import adminLogin from './routes/admin/adminLogin.js'
import adminTicketList from './routes/admin/ticketList.js'
import adminEditHistory from './routes/admin/editHistory.js'
import adminStaffManagement from './routes/admin/staffManagement.js'
import adminTicketEditor from './routes/admin/ticketEditor.js'
import adminDayTakings from './routes/admin/dayTakings.js'
import adminDailyChart from './routes/admin/dailyChart.js'
import adminUncollectedTickets from './routes/admin/uncollectedTickets.js'
import adminPrinterSettings from './routes/admin/printerSettings.js'
import adminBackups from './routes/admin/backups.js'
import adminCustomers from './routes/admin/customers.js'
import adminLoyalty from './routes/admin/loyalty.js'

import reportMonthlySummary from './routes/reports/monthlySummary.js'
import reportMoneySources from './routes/reports/moneySources.js'
import reportDaysList from './routes/reports/daysList.js'
import reportCustomers from './routes/reports/customers.js'
import reportTicketSummary from './routes/reports/ticketSummary.js'
import reportExcel from './routes/reports/excel.js'

import dryCleaningPrices from './routes/priceLists/dryCleaningPrices.js'
import serviceWashPrices from './routes/priceLists/serviceWashPrices.js'
import productPrices from './routes/priceLists/products.js'

import tillStaffSignIn from './routes/till/staffSignIn.js'
import tillCustomerSearch from './routes/till/customerSearch.js'
import tillSales from './routes/till/sales.js'
import tillSpending from './routes/till/tillSpending.js'
import tillActivity from './routes/till/tillActivity.js'

import newDryCleaningTicket from './routes/tickets/newDryCleaningTicket.js'
import newServiceWashTicket from './routes/tickets/newServiceWashTicket.js'
import cashDrawerRoutes from './routes/till/cashDrawer.js'
import ticketActions from './routes/tickets/ticketActions.js'
import ticketPrinting from './routes/tickets/ticketPrinting.js'

import health from './routes/health.js'

const app = express()

app.use(express.json())

// The admin routes need the admin to be logged in (see auth/accessRules.js)
app.use(adminOnlyRoutes)

// Admin
app.use(adminLogin)
app.use(adminTicketList)
app.use(adminEditHistory)
app.use(adminStaffManagement)
app.use(adminTicketEditor)
app.use(adminDayTakings)
app.use(adminDailyChart)
app.use(adminUncollectedTickets)
app.use(adminPrinterSettings)
app.use(adminBackups)
app.use(adminCustomers)
app.use(adminLoyalty)

// Admin reports
app.use(reportMonthlySummary)
app.use(reportMoneySources)
app.use(reportDaysList)
app.use(reportCustomers)
app.use(reportTicketSummary)
app.use(reportExcel)

// Price lists (read by the till, edited in Admin)
app.use(dryCleaningPrices)
app.use(serviceWashPrices)
app.use(productPrices)

// The till
app.use(tillStaffSignIn)
app.use(tillCustomerSearch)
app.use(tillSales)
app.use(tillSpending)
app.use(tillActivity)

// Tickets (made at the till or in Admin)
app.use(newDryCleaningTicket)
app.use(newServiceWashTicket)
app.use(ticketActions)
app.use(cashDrawerRoutes)
app.use(ticketPrinting)

app.use(health)

export default app
