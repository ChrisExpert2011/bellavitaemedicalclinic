import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { INSURANCES } from "@/lib/clinic";

/** Active insurances, editable by the admin. Falls back to the static list. */
export function useInsurances() {
  const query = useQuery({
    queryKey: ["insurances", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insurances")
        .select("id, name, active, sort_order")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const names =
    query.data && query.data.length > 0
      ? query.data.map((i) => i.name)
      : INSURANCES.filter((i) => i !== "None / Private");

  return { ...query, names: [...names, "None / Private"] };
}