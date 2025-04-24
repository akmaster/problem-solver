#!/usr/bin/env node
/**
 * index.ts
 * Bu dosya sorun-çözüm MCP sunucusunun ana giriş noktasıdır.
 * MCP sunucusunu yapılandırır, GitHub servisini başlatır ve araçları tanımlar.
 * 
 * Bağımlılıklar:
 * - @modelcontextprotocol/sdk: MCP sunucu SDK'sı
 * - github-service.ts: GitHub ile etkileşim için servis
 * - types.ts: Veri tipleri
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { GitHubService } from './github-service.js';
import { ProblemSolution, SearchFilter } from './types.js';
import { randomUUID } from 'crypto';

// GitHub yapılandırması
const GITHUB_OWNER = process.env.GITHUB_OWNER || '';
const GITHUB_REPO = process.env.GITHUB_REPO || '';
const GITHUB_PATH = process.env.GITHUB_PATH || 'problem-solver-data';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// GitHub yapılandırmasını doğrula
if (!GITHUB_OWNER || !GITHUB_REPO) {
  console.error('GITHUB_OWNER ve GITHUB_REPO ortam değişkenleri gereklidir');
  process.exit(1);
}

class ProblemSolverServer {
  private server: Server;
  private githubService: GitHubService;

  constructor() {
    // GitHub servisini başlat
    this.githubService = new GitHubService({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: GITHUB_PATH,
      token: GITHUB_TOKEN
    });

    // MCP sunucusunu başlat
    this.server = new Server(
      {
        name: 'problem-solver-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Araçları tanımla
    this.setupToolHandlers();
    
    // Hata yönetimi
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    // Kullanılabilir araçları listele
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'sorun_ekle',
          description: 'Yeni bir sorun ve çözümünü ekle',
          inputSchema: {
            type: 'object',
            properties: {
              baslik: {
                type: 'string',
                description: 'Sorunun başlığı'
              },
              aciklama: {
                type: 'string',
                description: 'Sorunun detaylı açıklaması'
              },
              cozum: {
                type: 'string',
                description: 'Sorunun çözümü'
              },
              kategori: {
                type: 'string',
                description: 'Sorunun kategorisi (örn: Yazılım, Donanım, Ağ)'
              },
              zorluk: {
                type: 'string',
                description: 'Sorunun zorluk seviyesi',
                enum: ['Kolay', 'Orta', 'Zor']
              },
              etiketler: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Sorunla ilgili etiketler'
              },
              gonderen: {
                type: 'string',
                description: 'Sorunu ekleyen kişinin adı'
              }
            },
            required: ['baslik', 'aciklama', 'cozum', 'kategori', 'gonderen']
          }
        },
        {
          name: 'sorun_ara',
          description: 'Sorunları ara ve filtrele',
          inputSchema: {
            type: 'object',
            properties: {
              arama: {
                type: 'string',
                description: 'Arama sorgusu (başlıkta, açıklamada, çözümde veya etiketlerde arar)'
              },
              kategori: {
                type: 'string',
                description: 'Belirli bir kategoriye göre filtrele'
              },
              zorluk: {
                type: 'string',
                description: 'Zorluk seviyesine göre filtrele',
                enum: ['Kolay', 'Orta', 'Zor']
              },
              etiketler: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Etiketlere göre filtrele'
              }
            }
          }
        },
        {
          name: 'sorun_getir',
          description: 'Belirli bir sorunu ID\'ye göre getir',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Sorunun benzersiz ID\'si'
              }
            },
            required: ['id']
          }
        },
        {
          name: 'bildirim_gonder',
          description: 'GitHub\'a yeni bir çözüm bildirimi gönder',
          inputSchema: {
            type: 'object',
            properties: {
              sorunId: {
                type: 'string',
                description: 'İlgili sorunun ID\'si'
              },
              mesaj: {
                type: 'string',
                description: 'Bildirim mesajı'
              },
              gonderen: {
                type: 'string',
                description: 'Bildirimi gönderen kişinin adı'
              }
            },
            required: ['sorunId', 'mesaj', 'gonderen']
          }
        }
      ],
    }));

    // Araç çağrılarını işle
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'sorun_ekle':
            return await this.handleAddProblem(request.params.arguments);
          
          case 'sorun_ara':
            return await this.handleSearchProblems(request.params.arguments);
          
          case 'sorun_getir':
            return await this.handleGetProblem(request.params.arguments);
          
          case 'bildirim_gonder':
            return await this.handleSendNotification(request.params.arguments);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Bilinmeyen araç: ${request.params.name}`
            );
        }
      } catch (error: any) {
        console.error(`Araç çağrısı işlenirken hata oluştu: ${error.message}`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Hata: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  /**
   * Yeni bir sorun ekleme aracını işler
   */
  private async handleAddProblem(args: any): Promise<any> {
    // Argümanları kontrol et
    if (!args.baslik || !args.aciklama || !args.cozum || !args.kategori || !args.gonderen) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Eksik parametreler: başlık, açıklama, çözüm, kategori ve gönderen alanları zorunludur'
      );
    }

    // Yeni sorun nesnesi oluştur
    const problem: ProblemSolution = {
      id: randomUUID(),
      title: args.baslik,
      description: args.aciklama,
      solution: args.cozum,
      category: args.kategori,
      difficulty: args.zorluk || 'Orta',
      tags: args.etiketler || [],
      createdBy: args.gonderen,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Sorunu kaydet
    await this.githubService.addProblem(problem);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: 'Sorun başarıyla eklendi',
              problem: {
                id: problem.id,
                title: problem.title,
                createdAt: problem.createdAt
              }
            },
            null,
            2
          )
        }
      ]
    };
  }

  /**
   * Sorunları arama aracını işler
   */
  private async handleSearchProblems(args: any): Promise<any> {
    // Arama filtresini oluştur
    const filter: SearchFilter = {
      query: args.arama,
      category: args.kategori,
      difficulty: args.zorluk,
      tags: args.etiketler
    };

    // Sorunları ara
    const problems = await this.githubService.searchProblems(filter);

    // Özet sonuçları döndür
    const results = problems.map(p => ({
      id: p.id,
      title: p.title,
      category: p.category,
      difficulty: p.difficulty,
      tags: p.tags,
      createdAt: p.createdAt
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              total: results.length,
              results
            },
            null,
            2
          )
        }
      ]
    };
  }

  /**
   * Belirli bir sorunu getirme aracını işler
   */
  private async handleGetProblem(args: any): Promise<any> {
    // ID'yi kontrol et
    if (!args.id) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Sorun ID\'si belirtilmelidir'
      );
    }

    // Sorunu getir
    const problem = await this.githubService.getProblemById(args.id);

    if (!problem) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `ID'si ${args.id} olan sorun bulunamadı`
      );
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(problem, null, 2)
        }
      ]
    };
  }

  /**
   * Bildirim gönderme aracını işler
   */
  private async handleSendNotification(args: any): Promise<any> {
    // Argümanları kontrol et
    if (!args.sorunId || !args.mesaj || !args.gonderen) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Eksik parametreler: sorunId, mesaj ve gönderen alanları zorunludur'
      );
    }

    // Sorunun varlığını kontrol et
    const problem = await this.githubService.getProblemById(args.sorunId);
    if (!problem) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `ID'si ${args.sorunId} olan sorun bulunamadı`
      );
    }

    // Bildirimi oluştur
    await this.githubService.createNotification({
      id: randomUUID(),
      problemId: args.sorunId,
      message: args.mesaj,
      sender: args.gonderen,
      createdAt: new Date().toISOString(),
      status: 'new'
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: 'Bildirim başarıyla gönderildi',
              problem: {
                id: problem.id,
                title: problem.title
              }
            },
            null,
            2
          )
        }
      ]
    };
  }

  /**
   * Sunucuyu başlat
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Problem-Solver MCP sunucusu stdio üzerinde çalışıyor');
  }
}

// Sunucuyu başlat
const server = new ProblemSolverServer();
server.run().catch(console.error);
