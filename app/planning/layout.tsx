import PlanSidebar from "@/components/planning/PlanSidebar";

export default function PlanningLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex -m-6 h-[calc(100vh-3rem)]">
      <PlanSidebar />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
