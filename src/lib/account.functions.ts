import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DeleteAccountResult = { success: true } | { success: false; message: string };

/**
 * Exclusão de conta de verdade (não confundir com "Apagar dados", que só
 * limpa despensa e receitas e mantém o login). Isso remove TUDO e não pode
 * ser desfeito.
 *
 * profiles, pantry_items, user_recipes, subscriptions, chat_usage,
 * diet_plans e photo_recognition_requests têm ON DELETE CASCADE pra
 * auth.users e somem automaticamente quando o usuário é apagado.
 * shopping_list_items e calorie_log NÃO têm FK pra auth.users (de propósito,
 * ver setup-novo-projeto.sql), então precisam ser limpas manualmente antes,
 * senão ficam órfãs no banco. As fotos enviadas ao Chef Despensa ficam no
 * storage (bucket pantry-photos/{userId}/...) e também não cascateiam.
 */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeleteAccountResult> => {
    const userId = context.userId;

    const [{ error: eShopping }, { error: eCalorie }] = await Promise.all([
      supabaseAdmin.from("shopping_list_items").delete().eq("user_id", userId),
      supabaseAdmin.from("calorie_log").delete().eq("user_id", userId),
    ]);
    if (eShopping || eCalorie) {
      console.error("deleteAccount cleanup", eShopping?.message, eCalorie?.message);
      return {
        success: false,
        message: "Não consegui limpar todos os seus dados. Tente novamente.",
      };
    }

    const { data: files } = await supabaseAdmin.storage.from("pantry-photos").list(userId);
    if (files && files.length > 0) {
      await supabaseAdmin.storage
        .from("pantry-photos")
        .remove(files.map((f) => `${userId}/${f.name}`));
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("deleteAccount", error.message);
      return { success: false, message: "Não consegui excluir sua conta. Tente novamente." };
    }
    return { success: true };
  });
