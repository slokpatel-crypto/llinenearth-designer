/** Owner-scoped customer history is only displayable when all four
 * independent production RPCs return genuine lists. A null/object/error
 * body must never be represented as an empty customer order history. */
export function hasCompleteCustomerProductionHistory(
  quotes:unknown,
  orders:unknown,
  orderEvents:unknown,
  outcomes:unknown,
):boolean{
  return Array.isArray(quotes)&&Array.isArray(orders)
    &&Array.isArray(orderEvents)&&Array.isArray(outcomes);
}
