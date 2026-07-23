insert into public.standards (code, title, description)
values (
  'ISO 9001-14001-45001',
  'Integrated quality, environmental and occupational safety system',
  'Full template package for ISO 9001, ISO 14001 and ISO 45001.'
)
on conflict (code) do update
set title = excluded.title,
    description = excluded.description;
