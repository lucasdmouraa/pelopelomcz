import { getAnimals } from "@/services/supabase";
import { CatalogComponent } from "@/components";

export const Catalog = async () => {
  const pets = await getAnimals();
  return (
    <section class="section white" id="catalog">
      <div class="section-content">
        <h2>Encontre seu novo amigo</h2>
        <CatalogComponent pets={pets} />
      </div>
    </section>
  );
};
