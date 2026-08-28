/** Short, human-scannable order reference — last 8 characters, uppercased. Shared by every admin order list/table. */
export function shortOrderId(id) {
  return `#${String(id).slice(-8).toUpperCase()}`;
}
