import { createClient } from "@supabase/supabase-js";

// Reemplaza estos valores con los que encuentras en:
// Settings -> API en tu Dashboard de Supabase
const supabaseUrl = "https://lexdqqolociwaavwpevl.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxleGRxcW9sb2Npd2FhdndwZXZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2ODkwMzMsImV4cCI6MjA4NDI2NTAzM30.bXpuga3GxiuIeP55LFRxgPDjQEHTpDYFKq4o3jdj7BM";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
