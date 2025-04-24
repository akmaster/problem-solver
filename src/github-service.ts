/**
 * github-service.ts
 * Bu dosya GitHub ile etkileşim için gerekli servis fonksiyonlarını içerir.
 * Sorun-çözüm verilerini GitHub üzerinde JSON dosyaları olarak yönetir.
 * 
 * Bağımlılıklar: 
 * - @octokit/rest: GitHub API ile etkileşim için
 * - types.ts: Veri tipleri için
 */

import { Octokit } from '@octokit/rest';
import { ProblemSolution, GitHubConfig, GitHubNotification, SearchFilter } from './types.js';

export class GitHubService {
  private octokit: Octokit;
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.token
    });
  }

  /**
   * Sorun-çözüm verilerini GitHub'dan alır
   */
  async getAllProblems(): Promise<ProblemSolution[]> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: `${this.config.path}/problems.json`,
      });

      if ('content' in response.data) {
        const content = Buffer.from(response.data.content as string, 'base64').toString('utf-8');
        return JSON.parse(content);
      }
      return [];
    } catch (error: any) {
      console.error('GitHub\'dan veriler alınırken hata oluştu:', error);
      // Dosya bulunamadıysa boş bir dizi döndür
      if (error.status === 404) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Yeni bir sorun-çözüm kaydını GitHub'a kaydeder
   */
  async addProblem(problem: ProblemSolution): Promise<ProblemSolution> {
    try {
      // Mevcut kayıtları getir
      const problems = await this.getAllProblems();
      
      // Yeni kaydı ekle
      problems.push(problem);
      
      // GitHub'a kaydet
      const content = Buffer.from(JSON.stringify(problems, null, 2)).toString('base64');
      
      try {
        // Dosyayı güncelle
        await this.octokit.rest.repos.createOrUpdateFileContents({
          owner: this.config.owner,
          repo: this.config.repo,
          path: `${this.config.path}/problems.json`,
          message: `Yeni sorun eklendi: ${problem.title}`,
          content,
          sha: await this.getFileSha(`${this.config.path}/problems.json`)
        });
      } catch (error: any) {
        // Dosya yoksa oluştur
        if (error.status === 404) {
          await this.octokit.rest.repos.createOrUpdateFileContents({
            owner: this.config.owner,
            repo: this.config.repo,
            path: `${this.config.path}/problems.json`,
            message: `Problem-çözüm veritabanı oluşturuldu`,
            content
          });
        } else {
          throw error;
        }
      }
      
      // Bildirim oluştur
      await this.createNotification({
        id: Date.now().toString(),
        problemId: problem.id,
        message: `Yeni sorun eklendi: ${problem.title}`,
        sender: problem.createdBy,
        createdAt: new Date().toISOString(),
        status: 'new'
      });
      
      return problem;
    } catch (error) {
      console.error('Sorun kaydedilirken hata oluştu:', error);
      throw error;
    }
  }

  /**
   * Problem-çözüm kayıtlarını arar ve filtreler
   */
  async searchProblems(filter: SearchFilter): Promise<ProblemSolution[]> {
    const problems = await this.getAllProblems();
    
    return problems.filter(problem => {
      // Metinde arama yap
      if (filter.query) {
        const query = filter.query.toLowerCase();
        const matchesQuery = 
          problem.title.toLowerCase().includes(query) || 
          problem.description.toLowerCase().includes(query) || 
          problem.solution.toLowerCase().includes(query) ||
          problem.tags.some(tag => tag.toLowerCase().includes(query));
        
        if (!matchesQuery) return false;
      }
      
      // Kategori filtreleme
      if (filter.category && problem.category !== filter.category) {
        return false;
      }
      
      // Zorluk seviyesi filtreleme
      if (filter.difficulty && problem.difficulty !== filter.difficulty) {
        return false;
      }
      
      // Etiket filtreleme
      if (filter.tags && filter.tags.length > 0) {
        const hasAllTags = filter.tags.every(tag => 
          problem.tags.some(t => t.toLowerCase() === tag.toLowerCase())
        );
        if (!hasAllTags) return false;
      }
      
      return true;
    });
  }

  /**
   * Problem detaylarını ID'ye göre getirir
   */
  async getProblemById(id: string): Promise<ProblemSolution | null> {
    const problems = await this.getAllProblems();
    return problems.find(p => p.id === id) || null;
  }

  /**
   * Bildirim oluştur ve GitHub'a kaydet
   */
  async createNotification(notification: GitHubNotification): Promise<void> {
    try {
      // Mevcut bildirimleri getir
      const notifications = await this.getNotifications();
      
      // Yeni bildirimi ekle
      notifications.push(notification);
      
      // GitHub'a kaydet
      const content = Buffer.from(JSON.stringify(notifications, null, 2)).toString('base64');
      
      try {
        // Dosyayı güncelle
        await this.octokit.rest.repos.createOrUpdateFileContents({
          owner: this.config.owner,
          repo: this.config.repo,
          path: `${this.config.path}/notifications.json`,
          message: `Yeni bildirim: ${notification.message}`,
          content,
          sha: await this.getFileSha(`${this.config.path}/notifications.json`)
        });
      } catch (error: any) {
        // Dosya yoksa oluştur
        if (error.status === 404) {
          await this.octokit.rest.repos.createOrUpdateFileContents({
            owner: this.config.owner,
            repo: this.config.repo,
            path: `${this.config.path}/notifications.json`,
            message: `Bildirim sistemi oluşturuldu`,
            content
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Bildirim oluşturulurken hata oluştu:', error);
      throw error;
    }
  }

  /**
   * Bildirimleri GitHub'dan getirir
   */
  async getNotifications(): Promise<GitHubNotification[]> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: `${this.config.path}/notifications.json`,
      });

      if ('content' in response.data) {
        const content = Buffer.from(response.data.content as string, 'base64').toString('utf-8');
        return JSON.parse(content);
      }
      return [];
    } catch (error: any) {
      // Dosya bulunamadıysa boş bir dizi döndür
      if (error.status === 404) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Dosyanın SHA değerini getirir (güncelleme için gerekli)
   */
  private async getFileSha(path: string): Promise<string> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
      });

      if ('sha' in response.data) {
        return response.data.sha;
      }
      throw new Error('SHA değeri bulunamadı');
    } catch (error) {
      throw error;
    }
  }
}
