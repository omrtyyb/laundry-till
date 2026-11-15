// The two kinds of ticket: dry cleaning and service wash.
// Both use the same TicketForm; these settings say what differs.

// Admin → Tickets saves to the admin routes (no worker sign-in needed) but prints the same way.
// printUrl is where the ticket is printed from when it isn't apiUrl.
export const TICKET_TYPES = {
  dryCleaning: {
    // Its colour class (see the colours at the top of styles/01-base.css)
    kind: "dryCleaning",
    title: "Dry Cleaning Ticket",
    apiUrl: "/api/dry-cleaning-tickets",
    descriptionLabel: "Clothes description",
    descriptionName: "clothes_description",
    hasNumberOfPieces: true,
    // A deposit can be taken now and the rest on collection
    hasDeposit: true,
    // Items are picked from the price list (Admin → Price list)
    hasPriceList: true,
  },
  serviceWash: {
    kind: "serviceWash",
    title: "Service Wash Ticket",
    apiUrl: "/api/service-wash-tickets",
    descriptionLabel: "Load description",
    descriptionName: "load_description",
    hasNumberOfPieces: false,
    hasDeposit: true,
    hasPriceList: false,
    // The load size is picked from the service wash price list (Admin → Price list)
    hasLoadSizes: true,
  },
};
