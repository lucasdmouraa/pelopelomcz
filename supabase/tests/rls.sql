-- Testes de RLS/triggers (V1 + V2 passo 1: papéis e censo) contra o projeto
-- remoto (`supabase db query --linked -f`). Tudo roda num bloco DO que termina
-- com RAISE EXCEPTION: o Postgres desfaz todas as alterações (inclusive a fila
-- do pg_net, então nenhum deploy é disparado) e o relatório vem no erro.
do $teste$
declare
  c record;
  obtido text;
  linhas int;
  relatorio text := '';
  falhas int := 0;
begin
  -- banco limpo para as contagens (tudo volta no RAISE final)
  delete from public.adoption_request;
  delete from public.animal;

  insert into auth.users (id, email, aud, role) values
    ('00000000-0000-0000-0000-00000000000a', 'admin@teste.local', 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000000b', 'pata@teste.local', 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000000c', 'sos@teste.local', 'authenticated', 'authenticated'),
    ('00000000-0000-0000-0000-00000000000e', 'vol@teste.local', 'authenticated', 'authenticated');
  insert into public.perfil (user_id, papel, ong_id, funcao, nome) values
    ('00000000-0000-0000-0000-00000000000a', 'admin', null, null, 'Admin Teste'),
    ('00000000-0000-0000-0000-00000000000b', 'ong', (select id from public.ong where slug = 'pata-amada'), 'coordenacao', 'Coord Pata'),
    ('00000000-0000-0000-0000-00000000000c', 'ong', (select id from public.ong where slug = 'sos-pet-pinheiro'), 'coordenacao', 'Coord SOS'),
    ('00000000-0000-0000-0000-00000000000e', 'ong', (select id from public.ong where slug = 'pata-amada'), 'voluntario', 'Vol Pata');
  insert into public.animal (ong_id, nome, especie, sexo, porte, idade, status)
  select o.id, v.nome, v.especie, v.sexo, v.porte, v.idade, 'disponivel'
  from (values
    ('pata-amada', 'Mel', 'cachorro', 'femea', 'medio', '2 anos'),
    ('pata-amada', 'Paçoca', 'gato', 'macho', 'pequeno', 'Filhote'),
    ('sos-pet-pinheiro', 'Trovão', 'cachorro', 'macho', 'grande', '4 anos'),
    ('sos-pet-pinheiro', 'Mel', 'gato', 'femea', 'pequeno', '1 ano'),
    ('projeto-acolher', 'Cacau', 'cachorro', 'femea', 'pequeno', '6 meses'),
    ('projeto-acolher', 'Sururu', 'cachorro', 'macho', 'gigante', '5 anos')
  ) as v (ong, nome, especie, sexo, porte, idade)
  join public.ong o on o.slug = v.ong;
  update public.animal set status = 'adotado' where nome = 'Cacau';
  perform set_config('teste.cacau', (select id::text from public.animal where nome = 'Cacau'), true);
  perform set_config('teste.trovao', (select id::text from public.animal where nome = 'Trovão'), true);
  perform set_config('teste.pacoca', (select id::text from public.animal where nome = 'Paçoca'), true);
  perform set_config('teste.pata', (select id::text from public.ong where slug = 'pata-amada'), true);
  perform set_config('teste.sos', (select id::text from public.ong where slug = 'sos-pet-pinheiro'), true);
  perform set_config('teste.melpata', (select a.id::text from public.animal a join public.ong o on o.id = a.ong_id where a.nome = 'Mel' and o.slug = 'pata-amada'), true);
  -- "ontem" no fuso de Maceió: os horários de ontem estão sempre no passado
  perform set_config('teste.ontem', (((now() at time zone 'America/Maceio')::date) - 1)::text, true);
  insert into public.adoption_request (name, contact, cpf, pet_id)
  select 'Fulano de Tal', '(82) 9 9999-9999', '000.000.000-00', a.id
  from public.animal a join public.ong o on o.id = a.ong_id
  where a.nome = 'Mel' and o.slug = 'pata-amada';

  for c in select * from (values
    ( 1, 'anon', null, 'valor', $q$select count(*) from public.animal$q$, '5', 'anon vê só pets disponíveis'),
    ( 2, 'anon', null, 'valor', $q$select count(*) from public.adoption_request$q$, '0', 'anon não vê pedidos'),
    ( 3, 'anon', null, 'valor', $q$select count(*) from public.perfil$q$, '0', 'anon não vê perfis'),
    ( 4, 'anon', null, 'valor', $q$select count(*) from public.foto$q$, '0', 'anon: nenhuma foto'),
    ( 5, 'anon', null, 'erro', $q$insert into public.adoption_request (name, contact, cpf, pet_id) select 'A B', '1', '2', id from public.animal where nome = 'Trovão'$q$, 'passou', 'anon envia pedido p/ pet disponível'),
    ( 6, 'anon', null, 'erro', $q$insert into public.adoption_request (name, contact, cpf, pet_id) values ('A B', '1', '2', current_setting('teste.cacau')::bigint)$q$, 'erro', 'anon NÃO envia pedido p/ pet adotado'),
    ( 7, 'anon', null, 'erro', $q$insert into public.adoption_request (name, contact, cpf, pet_id, status) select 'A B', '1', '2', id, 'concluido' from public.animal where nome = 'Trovão'$q$, 'erro', 'anon NÃO envia pedido já concluído'),
    ( 8, 'anon', null, 'erro', $q$insert into public.animal (ong_id, nome, especie, sexo, porte, idade) select id, 'X', 'gato', 'macho', 'pequeno', '1' from public.ong limit 1$q$, 'erro', 'anon NÃO cadastra animal'),
    ( 9, 'anon', null, 'erro', $q$select public.publicar_site(true)$q$, 'erro', 'anon NÃO chama publicar_site'),
    (10, 'anon', null, 'erro', $q$insert into public.votes (option) values (3)$q$, 'passou', 'anon vota'),

    (11, 'authenticated', 'b', 'valor', $q$select private.minha_ong() = (select id from public.ong where slug = 'pata-amada')$q$, 'true', 'minha_ong() é a Pata Amada'),
    (12, 'authenticated', 'b', 'valor', $q$select count(*) from public.animal where ong_id = private.minha_ong()$q$, '2', 'coordenação vê os 2 pets próprios'),
    (13, 'authenticated', 'b', 'valor', $q$select count(*) from public.adoption_request$q$, '1', 'coordenação vê só o pedido do próprio pet'),
    (14, 'authenticated', 'b', 'linhas', $q$update public.animal set idade = '3 anos' where nome = 'Paçoca'$q$, '1', 'coordenação edita pet próprio'),
    (15, 'authenticated', 'b', 'linhas', $q$update public.animal set idade = '9 anos' where nome = 'Trovão'$q$, '0', 'coordenação NÃO edita pet de outra ONG'),
    (16, 'authenticated', 'b', 'erro', $q$insert into public.animal (ong_id, nome, especie, sexo, porte, idade) select id, 'X', 'gato', 'macho', 'pequeno', '1' from public.ong where slug = 'sos-pet-pinheiro'$q$, 'erro', 'NÃO cadastra pet em outra ONG'),
    (17, 'authenticated', 'b', 'linhas', $q$update public.animal set ong_id = (select id from public.ong where slug = 'sos-pet-pinheiro') where nome = 'Paçoca'$q$, '-1', 'NÃO transfere pet para outra ONG'),
    (18, 'authenticated', 'b', 'erro', $q$insert into public.animal (ong_id, nome, especie, sexo, porte, idade) values (private.minha_ong(), 'João Café', 'cachorro', 'macho', 'pequeno', '1 ano')$q$, 'passou', 'coordenação cadastra pet'),
    (19, 'authenticated', 'b', 'valor', $q$select slug ~ '^joao-cafe-[0-9]+$' from public.animal where nome = 'João Café'$q$, 'true', 'slug gerado sem acento'),
    (20, 'authenticated', 'b', 'valor', $q$with antes as (select slug from public.animal where nome = 'João Café'), upd as (update public.animal set nome = 'João' where nome = 'João Café' returning slug) select (select slug from upd) = (select slug from antes)$q$, 'true', 'renomear não muda o slug'),
    (21, 'authenticated', 'b', 'erro', $q$insert into public.foto (animal_id, public_id) select id, 'pets/' || id || '/abc' from public.animal where nome = 'Paçoca'$q$, 'passou', 'foto na pasta do próprio pet'),
    (22, 'authenticated', 'b', 'erro', $q$insert into public.foto (animal_id, public_id) select id, 'pets/999/abc' from public.animal where nome = 'Paçoca'$q$, 'erro', 'NÃO grava foto fora da pasta do pet'),
    (23, 'authenticated', 'b', 'erro', $q$insert into public.foto (animal_id, public_id) select id, 'pets/' || id || '/x' from public.animal where nome = 'Trovão'$q$, 'erro', 'NÃO grava foto em pet de outra ONG'),
    (24, 'authenticated', 'b', 'linhas', $q$update public.adoption_request set status = 'em_contato', observacao = 'ligar sábado'$q$, '1', 'coordenação muda andamento do pedido'),
    (25, 'authenticated', 'b', 'linhas', $q$update public.adoption_request set cpf = '111'$q$, '-1', 'NÃO altera dados do interessado'),
    (26, 'authenticated', 'b', 'linhas', $q$update public.ong set descricao = 'Nova descrição' where id = private.minha_ong()$q$, '1', 'coordenação edita o perfil da ONG'),
    (27, 'authenticated', 'b', 'linhas', $q$update public.ong set ativa = false where id = private.minha_ong()$q$, '-1', 'coordenação NÃO desativa a ONG'),
    (28, 'authenticated', 'b', 'linhas', $q$update public.ong set descricao = 'x' where slug = 'sos-pet-pinheiro'$q$, '0', 'NÃO edita outra ONG'),
    (29, 'authenticated', 'b', 'linhas', $q$update public.perfil set papel = 'admin', ong_id = null, funcao = null where user_id = auth.uid()$q$, '0', 'NÃO se promove a admin'),
    (30, 'authenticated', 'b', 'linhas', $q$update public.perfil set funcao = 'coordenacao' where user_id = '00000000-0000-0000-0000-00000000000e'$q$, '0', 'coordenação NÃO muda função direto no banco (só pela Edge Function)'),
    (31, 'authenticated', 'b', 'erro', $q$insert into public.perfil (user_id, papel) values ('00000000-0000-0000-0000-00000000000c', 'admin')$q$, 'erro', 'NÃO cria perfil'),
    (32, 'authenticated', 'b', 'erro', $q$select public.publicar_agora()$q$, 'erro', 'NÃO publica manualmente'),
    (33, 'authenticated', 'b', 'valor', $q$select count(*) from public.newsletter$q$, '0', 'NÃO lê newsletter'),

    (34, 'authenticated', 'c', 'valor', $q$select count(*) from public.adoption_request a join public.animal p on p.id = a.pet_id where p.nome <> 'Trovão'$q$, '0', 'SOS NÃO vê pedidos da Pata Amada'),
    (35, 'authenticated', 'c', 'valor', $q$select count(*) from public.adoption_request$q$, '1', 'SOS vê o pedido do próprio Trovão'),

    (36, 'authenticated', 'e', 'valor', $q$select count(*) from public.adoption_request$q$, '0', 'voluntário NÃO vê pedidos (CPF)'),
    (37, 'authenticated', 'e', 'linhas', $q$update public.adoption_request set status = 'concluido'$q$, '0', 'voluntário NÃO altera pedidos'),
    (38, 'authenticated', 'e', 'linhas', $q$delete from public.animal where nome = 'Paçoca'$q$, '0', 'voluntário NÃO apaga pet'),
    (39, 'authenticated', 'e', 'linhas', $q$update public.ong set descricao = 'x' where id = private.minha_ong()$q$, '0', 'voluntário NÃO edita a ONG'),
    (40, 'authenticated', 'e', 'erro', $q$insert into public.animal (ong_id, nome, especie, sexo, porte, idade, status) values (private.minha_ong(), 'Vol Pet', 'gato', 'macho', 'pequeno', '1', 'disponivel')$q$, 'passou', 'voluntário cadastra pet'),
    (41, 'authenticated', 'e', 'valor', $q$select status from public.animal where nome = 'Vol Pet'$q$, 'em_avaliacao', 'pet do voluntário nasce em avaliação (mesmo pedindo disponível)'),
    (42, 'authenticated', 'e', 'linhas', $q$update public.animal set status = 'morador' where nome = 'Paçoca'$q$, '-1', 'voluntário NÃO muda a situação'),
    (43, 'authenticated', 'e', 'linhas', $q$update public.animal set idade = '4 anos' where nome = 'Paçoca'$q$, '1', 'voluntário edita dados do pet'),
    (44, 'authenticated', 'e', 'valor', $q$select count(*) from public.perfil$q$, '2', 'voluntário vê só a própria equipe'),
    (45, 'authenticated', 'e', 'linhas', $q$update public.animal_ficha set origem_resgate = 'Praça' where animal_id = current_setting('teste.pacoca')::bigint$q$, '1', 'voluntário preenche a ficha'),
    (46, 'authenticated', 'e', 'valor', $q$select f.registrado_por_nome from public.animal_ficha f join public.animal a on a.id = f.animal_id where a.nome = 'Paçoca'$q$, 'Vol Pata', 'ficha registra o autor'),
    (47, 'authenticated', 'e', 'linhas', $q$update public.animal_ficha set observacoes = 'x' where animal_id = current_setting('teste.trovao')::bigint$q$, '0', 'NÃO preenche ficha de pet de outra ONG'),

    (48, 'authenticated', 'b', 'linhas', $q$update public.animal set status = 'disponivel' where nome = 'João'$q$, '1', 'coordenação publica pet'),
    (49, 'authenticated', 'b', 'valor', $q$select count(*) from public.animal_ficha where origem_resgate is not null$q$, '1', 'coordenação vê a ficha feita pela equipe'),
    (50, 'authenticated', 'c', 'valor', $q$select count(*) from public.animal_ficha where ong_id = current_setting('teste.pata')::bigint$q$, '0', 'outra ONG NÃO vê a ficha'),

    (51, 'authenticated', 'a', 'valor', $q$select count(*) from public.animal$q$, '8', 'admin vê todos os pets'),
    (52, 'authenticated', 'a', 'valor', $q$select count(*) from public.adoption_request$q$, '2', 'admin vê todos os pedidos'),
    (53, 'authenticated', 'a', 'linhas', $q$update public.ong set ativa = false where slug = 'sos-pet-pinheiro'$q$, '1', 'admin desativa ONG'),
    (54, 'authenticated', 'a', 'erro', $q$insert into public.ong (slug, nome) values ('nova-ong', 'Nova ONG')$q$, 'passou', 'admin cadastra ONG'),

    (55, 'anon', null, 'valor', $q$select count(*) from public.animal$q$, '4', 'vitrine: Mel, Paçoca, João e Sururu (SOS desativada, Cacau adotado, Vol Pet em avaliação)'),
    (56, 'anon', null, 'valor', $q$select count(*) from public.ong where slug <> 'ong-teste'$q$, '3', 'ONG desativada some dos parceiros'),
    (57, 'anon', null, 'erro', $q$select count(*) from public.animal_ficha$q$, 'erro', 'anon NÃO lê ficha'),

    -- V2 passo 3: prontuário
    (60, 'authenticated', 'e', 'erro', $q$insert into public.evento_saude (animal_id, tipo, produto, data, proxima_data) select id, 'vacina', 'V10', current_date - 365, current_date - 2 from public.animal where nome = 'Paçoca'$q$, 'passou', 'voluntário registra vacina'),
    (61, 'authenticated', 'e', 'valor', $q$select ong_id = private.minha_ong() and registrado_por_nome = 'Vol Pata' from public.evento_saude where produto = 'V10'$q$, 'true', 'ONG e autor do evento vêm do banco'),
    (62, 'authenticated', 'e', 'erro', $q$insert into public.evento_saude (animal_id, tipo) values (current_setting('teste.trovao')::bigint, 'consulta')$q$, 'erro', 'NÃO registra saúde de pet de outra ONG (id direto)'),
    (63, 'authenticated', 'e', 'erro', $q$insert into public.evento_saude (animal_id, tipo) select id, 'peso' from public.animal where nome = 'Paçoca'$q$, 'erro', 'peso exige o valor em kg'),
    (64, 'authenticated', 'e', 'valor', $q$select count(*) from public.vencimentos(current_date + 7)$q$, '1', 'vencimentos lista a vacina vencida'),
    (65, 'authenticated', 'c', 'valor', $q$select count(*) from public.evento_saude$q$, '0', 'outra ONG NÃO vê o prontuário'),
    (66, 'authenticated', 'c', 'valor', $q$select count(*) from public.vencimentos(current_date + 7)$q$, '0', 'outra ONG NÃO vê os vencimentos'),
    (67, 'anon', null, 'erro', $q$select count(*) from public.evento_saude$q$, 'erro', 'anon NÃO lê prontuário'),
    (68, 'anon', null, 'erro', $q$select count(*) from public.vencimentos(current_date + 7)$q$, 'erro', 'anon NÃO chama vencimentos'),
    (69, 'authenticated', 'b', 'erro', $q$insert into public.evento_saude (animal_id, tipo, produto, data, proxima_data) select id, 'vacina', 'v10', current_date, current_date + 365 from public.animal where nome = 'Paçoca'$q$, 'passou', 'coordenação registra o reforço'),
    (70, 'authenticated', 'b', 'valor', $q$select lembrete_resolvido from public.evento_saude where produto = 'V10'$q$, 'true', 'reforço resolve o lembrete anterior (produto sem diferenciar maiúsculas)'),
    (71, 'authenticated', 'b', 'valor', $q$select count(*) from public.vencimentos(current_date + 7)$q$, '0', 'lembrete resolvido some de vencimentos'),
    (72, 'authenticated', 'e', 'linhas', $q$delete from public.evento_saude where produto = 'v10'$q$, '0', 'voluntário NÃO apaga registro de outra pessoa'),
    (73, 'authenticated', 'e', 'linhas', $q$delete from public.evento_saude where produto = 'V10'$q$, '1', 'voluntário apaga o próprio registro'),

    -- V2 passo 4: remédios e doses (Antibiótico: ontem 07:00 até amanhã 07:00, 08h/20h;
    -- Colírio: desde ontem 15:00, 08h/20h a cada 2 dias)
    (74, 'authenticated', 'b', 'erro', $q$insert into public.tratamento (animal_id, medicamento, horarios, inicio, fim) values (current_setting('teste.pacoca')::bigint, 'Antibiótico', '{08:00,20:00}', ((current_setting('teste.ontem')::date + time '07:00') at time zone 'America/Maceio'), ((current_setting('teste.ontem')::date + 2 + time '07:00') at time zone 'America/Maceio'))$q$, 'passou', 'coordenação cadastra tratamento'),
    (75, 'authenticated', 'b', 'erro', $q$insert into public.tratamento (animal_id, medicamento, horarios, intervalo_dias, inicio) values (current_setting('teste.pacoca')::bigint, 'Colírio', '{08:00,20:00}', 2, ((current_setting('teste.ontem')::date + time '15:00') at time zone 'America/Maceio'))$q$, 'passou', 'tratamento a cada 2 dias'),
    (76, 'postgres', null, 'erro', $q$select set_config('teste.trat', (select id::text from public.tratamento where medicamento = 'Antibiótico'), true)$q$, 'passou', '(prepara id do tratamento)'),
    (77, 'authenticated', 'e', 'valor', $q$select (count(*) filter (where medicamento = 'Antibiótico'))::text || ',' || (count(*) filter (where medicamento = 'Colírio'))::text from public.doses_previstas(((current_setting('teste.ontem')::date + time '00:00') at time zone 'America/Maceio'), ((current_setting('teste.ontem')::date + 4 + time '00:00') at time zone 'America/Maceio'), current_setting('teste.pacoca')::bigint)$q$, '4,3', 'agenda: respeita início 15h, fim e intervalo de 2 dias'),
    (78, 'authenticated', 'e', 'erro', $q$insert into public.dose (tratamento_id, previsto_para) values (current_setting('teste.trat')::bigint, ((current_setting('teste.ontem')::date + time '08:00') at time zone 'America/Maceio'))$q$, 'passou', 'voluntário registra dose'),
    (79, 'authenticated', 'b', 'erro', $q$insert into public.dose (tratamento_id, previsto_para) values (current_setting('teste.trat')::bigint, ((current_setting('teste.ontem')::date + time '08:00') at time zone 'America/Maceio'))$q$, 'erro', 'dose repetida é recusada'),
    (80, 'authenticated', 'e', 'erro', $q$insert into public.dose (tratamento_id, previsto_para) values (current_setting('teste.trat')::bigint, ((current_setting('teste.ontem')::date + time '08:00:00.001') at time zone 'America/Maceio'))$q$, 'erro', 'horário inventado é recusado'),
    (81, 'authenticated', 'e', 'erro', $q$insert into public.dose (tratamento_id, previsto_para) select id, ((current_setting('teste.ontem')::date + 2 + time '20:00') at time zone 'America/Maceio') from public.tratamento where medicamento = 'Colírio'$q$, 'erro', 'dose de amanhã é recusada'),
    (82, 'authenticated', 'e', 'erro', $q$insert into public.dose (tratamento_id, previsto_para, dada_por, dada_por_nome) values (current_setting('teste.trat')::bigint, ((current_setting('teste.ontem')::date + time '20:00') at time zone 'America/Maceio'), '00000000-0000-0000-0000-00000000000b', 'Coord Pata')$q$, 'passou', '(dose tentando se passar pela coordenação)'),
    (83, 'authenticated', 'e', 'valor', $q$select dada_por_nome from public.dose where previsto_para = ((current_setting('teste.ontem')::date + time '20:00') at time zone 'America/Maceio')$q$, 'Vol Pata', 'quem deu é sempre quem está logado'),
    (84, 'authenticated', 'b', 'valor', $q$select count(*) from public.doses_previstas(((current_setting('teste.ontem')::date + time '00:00') at time zone 'America/Maceio'), ((current_setting('teste.ontem')::date + 4 + time '00:00') at time zone 'America/Maceio')) where dose_id is not null$q$, '2', 'agenda mostra as doses já dadas'),
    (85, 'authenticated', 'c', 'valor', $q$select count(*) from public.tratamento$q$, '0', 'outra ONG NÃO vê tratamentos'),
    (86, 'authenticated', 'c', 'erro', $q$insert into public.dose (tratamento_id, previsto_para) values (current_setting('teste.trat')::bigint, ((current_setting('teste.ontem')::date + time '20:00') at time zone 'America/Maceio'))$q$, 'erro', 'outra ONG NÃO registra dose (id direto)'),
    (87, 'authenticated', 'e', 'linhas', $q$delete from public.dose where previsto_para = ((current_setting('teste.ontem')::date + time '08:00') at time zone 'America/Maceio')$q$, '1', 'voluntário desfaz a própria dose (15 min)'),
    (88, 'authenticated', 'e', 'linhas', $q$update public.dose set pulada = true$q$, '-1', 'dose não se edita'),
    (89, 'authenticated', 'b', 'linhas', $q$update public.tratamento set horarios = '{09:00}' where medicamento = 'Antibiótico'$q$, '-1', 'horários de um tratamento não mudam'),
    (90, 'authenticated', 'b', 'linhas', $q$update public.tratamento set fim = now() where medicamento = 'Antibiótico'$q$, '1', 'coordenação encerra tratamento'),
    (91, 'authenticated', 'e', 'linhas', $q$delete from public.tratamento where medicamento = 'Colírio'$q$, '0', 'voluntário NÃO apaga tratamento'),
    (92, 'authenticated', 'b', 'linhas', $q$update public.animal set status = 'adotado' where nome = 'Paçoca'$q$, '1', '(Paçoca adotado)'),
    (93, 'authenticated', 'b', 'valor', $q$select count(*) from public.tratamento where animal_id = current_setting('teste.pacoca')::bigint and (fim is null or fim > now())$q$, '0', 'adoção encerra os tratamentos em aberto'),
    (97, 'authenticated', 'b', 'valor', $q$select count(*) from public.doses_previstas(((current_setting('teste.ontem')::date + time '00:00') at time zone 'America/Maceio'), ((current_setting('teste.ontem')::date + 4 + time '00:00') at time zone 'America/Maceio'), current_setting('teste.pacoca')::bigint) where dose_id is null$q$, '0', 'pet adotado não tem doses pendentes na agenda'),
    (98, 'authenticated', 'b', 'valor', $q$select count(*) from public.doses_previstas(((current_setting('teste.ontem')::date + time '00:00') at time zone 'America/Maceio'), ((current_setting('teste.ontem')::date + 4 + time '00:00') at time zone 'America/Maceio'), current_setting('teste.pacoca')::bigint) where dose_id is not null$q$, '1', 'doses já registradas continuam no histórico'),
    (94, 'anon', null, 'erro', $q$select count(*) from public.tratamento$q$, 'erro', 'anon NÃO lê tratamentos'),
    (95, 'anon', null, 'erro', $q$select count(*) from public.dose$q$, 'erro', 'anon NÃO lê doses'),
    (96, 'anon', null, 'erro', $q$select count(*) from public.doses_previstas(now(), now() + interval '1 day')$q$, 'erro', 'anon NÃO chama doses_previstas'),

    -- V2 passo 6: documentos (tabela e Storage)
    (100, 'authenticated', 'e', 'erro', $q$insert into public.documento (animal_id, tipo, nome, caminho) values (current_setting('teste.melpata')::bigint, 'exame', 'a.pdf', 'ong/' || current_setting('teste.pata') || '/equipe/' || current_setting('teste.melpata') || '/a.pdf')$q$, 'passou', 'voluntário registra documento da equipe'),
    (101, 'authenticated', 'e', 'erro', $q$insert into public.documento (animal_id, tipo, nome, caminho, restrito) values (current_setting('teste.melpata')::bigint, 'termo_adocao', 'b.pdf', 'ong/' || current_setting('teste.pata') || '/restrito/' || current_setting('teste.melpata') || '/b.pdf', true)$q$, 'erro', 'voluntário NÃO guarda documento restrito'),
    (102, 'authenticated', 'b', 'erro', $q$insert into public.documento (animal_id, tipo, nome, caminho, restrito) values (current_setting('teste.melpata')::bigint, 'termo_adocao', 'c.pdf', 'ong/' || current_setting('teste.pata') || '/restrito/' || current_setting('teste.melpata') || '/c.pdf', true)$q$, 'passou', 'coordenação guarda documento restrito'),
    (103, 'authenticated', 'e', 'valor', $q$select count(*) from public.documento$q$, '1', 'voluntário NÃO vê documentos restritos'),
    (104, 'authenticated', 'b', 'valor', $q$select count(*) from public.documento$q$, '2', 'coordenação vê todos os documentos da ONG'),
    (105, 'authenticated', 'e', 'erro', $q$insert into public.documento (animal_id, tipo, nome, caminho) values (current_setting('teste.melpata')::bigint, 'exame', 'd.pdf', 'ong/' || current_setting('teste.pata') || '/equipe/999/d.pdf')$q$, 'erro', 'caminho precisa bater com ONG, pasta e pet'),
    (106, 'authenticated', 'c', 'valor', $q$select count(*) from public.documento$q$, '0', 'outra ONG NÃO vê documentos'),
    (107, 'anon', null, 'erro', $q$select count(*) from public.documento$q$, 'erro', 'anon NÃO lê documentos'),
    (108, 'authenticated', 'e', 'erro', $q$insert into storage.objects (bucket_id, name) values ('documentos', 'ong/' || current_setting('teste.pata') || '/equipe/' || current_setting('teste.melpata') || '/x.pdf')$q$, 'passou', 'Storage: voluntário envia arquivo da equipe'),
    (109, 'authenticated', 'e', 'erro', $q$insert into storage.objects (bucket_id, name) values ('documentos', 'ong/' || current_setting('teste.pata') || '/restrito/' || current_setting('teste.melpata') || '/y.pdf')$q$, 'erro', 'Storage: voluntário NÃO envia arquivo restrito'),
    (110, 'authenticated', 'e', 'erro', $q$insert into storage.objects (bucket_id, name) values ('documentos', 'ong/' || current_setting('teste.sos') || '/equipe/' || current_setting('teste.trovao') || '/z.pdf')$q$, 'erro', 'Storage: NÃO envia na pasta de outra ONG'),
    (111, 'authenticated', 'b', 'erro', $q$insert into storage.objects (bucket_id, name) values ('documentos', 'ong/' || current_setting('teste.pata') || '/restrito/' || current_setting('teste.melpata') || '/w.pdf')$q$, 'passou', 'Storage: coordenação envia arquivo restrito'),
    (112, 'authenticated', 'e', 'valor', $q$select count(*) from storage.objects where bucket_id = 'documentos'$q$, '1', 'Storage: voluntário só vê arquivos da equipe'),
    (113, 'authenticated', 'c', 'valor', $q$select count(*) from storage.objects where bucket_id = 'documentos'$q$, '0', 'Storage: outra ONG NÃO vê os arquivos'),
    (114, 'anon', null, 'valor', $q$select count(*) from storage.objects where bucket_id = 'documentos'$q$, '0', 'Storage: anon NÃO vê arquivos'),
    (115, 'authenticated', 'a', 'linhas', $q$update public.animal set ong_id = current_setting('teste.sos')::bigint where id = current_setting('teste.melpata')::bigint$q$, '-1', 'pet com documentos NÃO troca de ONG'),

    -- linha do tempo: quem cadastrou o pet (na ficha, nunca em `animal`)
    (116, 'authenticated', 'e', 'valor', $q$select f.cadastrado_por_nome from public.animal_ficha f join public.animal a on a.id = f.animal_id where a.nome = 'Vol Pet'$q$, 'Vol Pata', 'ficha nasce com quem cadastrou o pet'),
    (117, 'authenticated', 'e', 'linhas', $q$update public.animal_ficha f set cadastrado_por_nome = 'Outra pessoa' from public.animal a where a.id = f.animal_id and a.nome = 'Vol Pet'$q$, '1', '(tenta trocar quem cadastrou)'),
    (118, 'authenticated', 'e', 'valor', $q$select f.cadastrado_por_nome from public.animal_ficha f join public.animal a on a.id = f.animal_id where a.nome = 'Vol Pet'$q$, 'Vol Pata', 'quem cadastrou não pode ser alterado'),

    (198, 'postgres', null, 'valor', $q$select alterado_em is not null from public.site_estado$q$, 'true', 'alterações marcam site_estado'),
    (199, 'postgres', null, 'valor', $q$select count(*) from cron.job where jobname = 'publicar-site'$q$, '1', 'job do cron agendado')
  ) as t (ordem, papel, sub, tipo, cmd, esperado, nome) order by ordem
  loop
    if c.papel = 'postgres' then
      execute 'reset role';
      perform set_config('request.jwt.claims', '', true);
    else
      execute format('set local role %I', c.papel);
      perform set_config('request.jwt.claims', json_build_object(
        'sub', case when c.sub is null then null else '00000000-0000-0000-0000-00000000000' || c.sub end,
        'role', c.papel)::text, true);
    end if;

    begin
      if c.tipo = 'valor' then
        execute c.cmd into obtido;
      elsif c.tipo = 'erro' then
        execute c.cmd;
        obtido := 'passou';
      else
        execute c.cmd;
        get diagnostics linhas = row_count;
        obtido := linhas::text;
      end if;
    exception when others then
      obtido := case c.tipo when 'erro' then 'erro' when 'linhas' then '-1' else 'ERRO: ' || sqlerrm end;
    end;

    execute 'reset role';
    if obtido is distinct from c.esperado then
      falhas := falhas + 1;
      relatorio := relatorio || format(E'FALHOU  %s (obtido: %s, esperado: %s)\n', c.nome, obtido, c.esperado);
    else
      relatorio := relatorio || format(E'ok      %s\n', c.nome);
    end if;
  end loop;

  raise exception using message = format(E'RELATORIO (%s falha(s)) — tudo desfeito\n%s', falhas, relatorio);
end;
$teste$;
