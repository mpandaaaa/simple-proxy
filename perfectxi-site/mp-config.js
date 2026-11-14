/* =====================================================================
   PERFECT XI MULTIPLAYER - LIVE
   These two values point the game at your Supabase project.
   Both are safe to publish. The publishable key is designed to sit in a
   browser; what keeps the data safe is the row level security rules on
   the database, not secrecy.
   Never put the service_role key here. That one is a master key and
   lives only inside the score-run function, where Supabase supplies it.
   ===================================================================== */
window.PXI_MP = {
  URL:  "https://fmupfnknfyiiddwgjlvk.supabase.co",
  KEY:  "sb_publishable_PlbOP9B2umhLCiH8hRO-Ag_vldKYAcb",
  ON:   function(){ return !!(this.URL && this.KEY); }
};
