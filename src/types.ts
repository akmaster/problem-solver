/**
 * types.ts
 * Bu dosya sorun-çözüm MCP sunucusunun kullandığı veri tiplerini tanımlar.
 * 
 * Bağımlılıklar: Yok
 */

// Sorun-çözüm kaydının yapısı
export interface ProblemSolution {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  solution: string;
  difficulty: 'Kolay' | 'Orta' | 'Zor';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// GitHub bildirim yapısı
export interface GitHubNotification {
  id: string;
  problemId: string;
  message: string;
  sender: string;
  createdAt: string;
  status: 'new' | 'read';
}

// Arama filtresi
export interface SearchFilter {
  query?: string;
  category?: string;
  tags?: string[];
  difficulty?: 'Kolay' | 'Orta' | 'Zor';
}

// GitHub yapılandırması
export interface GitHubConfig {
  owner: string;
  repo: string;
  path: string;
  token?: string;
}
