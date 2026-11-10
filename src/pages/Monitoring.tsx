import { Heading, Panel } from "../components/ui";
import MonitoringTable from "../components/MonitoringTable";
export default function Monitoring({ kind }: { kind: "unit" | "rumah_sakit" }) {
  return (
    <>
      <Heading
        eyebrow="MONITORING PELAYANAN"
        title={
          kind === "unit" ? "Indikator Mutu Unit" : "Indikator Mutu Rumah Sakit"
        }
      >
        {kind === "unit"
          ? "24 indikator prioritas unit. Kode RSAS-U adalah ID internal aplikasi."
          : "10 indikator prioritas rumah sakit. Penugasan observasi dikelola melalui Master Indikator."}
      </Heading>
      <Panel>
        <MonitoringTable kind={kind} />
      </Panel>
    </>
  );
}
