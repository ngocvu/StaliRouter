import { getMachineId } from "@/shared/utils/machine";
import EndpointPageClient from "./endpoint/EndpointPageClient";
import StaliSetupClient from "./stali-setup/StaliSetupClient";

export default async function DashboardPage() {
  const staliOnly = process.env.STALI_ONLY_MODE !== "false";
  if (staliOnly) {
    return <StaliSetupClient />;
  }
  const machineId = await getMachineId();
  return <EndpointPageClient machineId={machineId} />;
}
