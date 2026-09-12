-- Dados de exemplo para desenvolvimento local (roda só em `supabase db reset`
-- / `supabase start`, nunca no projeto em produção).

insert into public.animal (ong_id, nome, especie, sexo, porte, idade, descricao, vacinado, vermifugado, castrado, especial)
select o.id, v.nome, v.especie, v.sexo, v.porte, v.idade, v.descricao, v.vacinado, v.vermifugado, v.castrado, v.especial
from (values
  ('pata-amada', 'Mel', 'cachorro', 'femea', 'medio', '2 anos', 'Resgatada na orla da Pajuçara, adora colo.', true, true, true, false),
  ('pata-amada', 'Paçoca', 'gato', 'macho', 'pequeno', 'Filhote', null, false, true, false, false),
  ('sos-pet-pinheiro', 'Trovão', 'cachorro', 'macho', 'grande', '4 anos', 'Muito calmo, se dá bem com crianças.', true, true, true, false),
  ('sos-pet-pinheiro', 'Mel', 'gato', 'femea', 'pequeno', '1 ano', null, true, true, true, true),
  ('projeto-acolher', 'Cacau', 'cachorro', 'femea', 'pequeno', '6 meses', null, false, true, false, false),
  ('projeto-acolher', 'Sururu', 'cachorro', 'macho', 'gigante', '5 anos', 'Grandão e carinhoso.', true, true, true, false)
) as v (ong, nome, especie, sexo, porte, idade, descricao, vacinado, vermifugado, castrado, especial)
join public.ong o on o.slug = v.ong;

-- sem status explícito o pet nasce "em_avaliacao"; publica os de exemplo
update public.animal set status = 'disponivel';
update public.animal set status = 'adotado' where nome = 'Cacau';
update public.animal set status = 'morador' where nome = 'Sururu';
