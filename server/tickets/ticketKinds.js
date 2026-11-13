// The two kinds of ticket (dry cleaning and service wash) and the names used for them in
// URLs, database tables and Admin.

// URL name -> table, e.g. /api/dry-cleaning-tickets/12 is in dry_cleaning_tickets
export const TICKET_TABLES = {
  'dry-cleaning-tickets': 'dry_cleaning_tickets',
  'service-wash-tickets': 'service_wash_tickets',
}
// Admin → Tickets kind name -> its table, label and description column
export const ADMIN_TICKET_KINDS = {
  dryCleaning: { table: 'dry_cleaning_tickets', label: 'Dry cleaning', descriptionColumn: 'clothes_description' },
  serviceWash: { table: 'service_wash_tickets', label: 'Service wash', descriptionColumn: 'load_description' },
}

// The pickup day on a ticket is a day of the week
export const PICKUP_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
