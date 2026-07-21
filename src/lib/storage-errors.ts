export function storageErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("row-level security") || normalized.includes("unauthorized")) {
    return "Няма разрешение за запис във фирмения архив. Изпълнете миграция 006 в Supabase.";
  }

  if (normalized.includes("bucket not found")) {
    return "Фирменият архив не е създаден. Изпълнете миграция 005 в Supabase.";
  }

  return message;
}
