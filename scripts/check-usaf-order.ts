// Quick script to check USAF order status
import { getOrderStatus } from "../src/lib/usautoforce/client";

async function main() {
  const orderNumber = "HDS26692934";
  console.log(`Checking USAF order ${orderNumber}...`);
  
  const result = await getOrderStatus(orderNumber);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
