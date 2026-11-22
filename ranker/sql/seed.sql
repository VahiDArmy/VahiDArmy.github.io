-- Seed default traits (idempotent)
insert into public.t3d_traits (name, description, icon, color, position) values
  ('Kindness',   'Warmth, generosity and care for others',      '💚', '#B5F5C7', 1),
  ('Bravery',    'Courage under pressure and risk-taking',      '🔥', '#FFC7A7', 2),
  ('Intelligence','Analytical sharpness and learning speed',    '🧠', '#A7E8FF', 3),
  ('Creativity', 'Original thinking and aesthetic sense',        '🎨', '#FFACE4', 4),
  ('Humor',      'Playfulness and ability to make people laugh', '😄', '#FFE4A7', 5),
  ('Reliability','Consistency and keeping promises',             '🛡️', '#C7B5FF', 6),
  ('Empathy',    'Feeling and understanding others emotions',    '💗', '#FFB5C7', 7),
  ('Leadership', 'Inspiring direction and taking responsibility', '👑', '#FFD4A7', 8)
on conflict (name) do nothing;

-- Optional: seed demo scores if at least 3 people exist
do $$
declare
  p uuid[];
  t uuid[];
  n int;
begin
  select array_agg(id) into p from public.people limit 8;
  select array_agg(id) into t from public.t3d_traits;
  if p is null or array_length(p,1) < 3 or t is null then
    return;
  end if;
  n := array_length(p,1);
  for i in 1..n loop
    for j in 1..n loop
      if i <> j then
        for k in 1..array_length(t,1) loop
          insert into public.t3d_scores (rater_person_id, ratee_person_id, trait_id, score)
          values (p[i], p[j], t[k], 20 + floor(random()*80)::numeric)
          on conflict (rater_person_id, ratee_person_id, trait_id) do nothing;
        end loop;
      end if;
    end loop;
  end loop;
end $$;
