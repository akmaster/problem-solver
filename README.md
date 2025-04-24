# Problem Solver MCP Sunucusu

Bu MCP (Model Context Protocol) sunucusu, Claude için bir sorun-çözüm bilgi tabanı sunar. Kullanıcılar teknik sorunları ve çözümlerini saklayabilir, arayabilir ve paylaşabilir.

## Özellikler

- **Sorun Ekleme:** Yeni sorunlar ve çözümleri GitHub deposunda saklama
- **Sorun Arama:** Anahtar kelime, kategori, zorluk seviyesi veya etiketlere göre arama
- **Sorun Getirme:** ID'ye göre belirli bir sorunu alma
- **Bildirim Gönderme:** Mevcut sorunlar için ek çözüm önerileri gönderme

## Kurulum

1. Projeyi klonlayın:
```bash
git clone https://github.com/kullanici_adiniz/problem-solver-mcp.git
cd problem-solver-mcp
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. Projeyi derleyin:
```bash
npm run build
```

4. MCP ayarlarınıza ekleyin:
```json
"problem-solver-mcp": {
  "autoApprove": [
    "sorun_ekle",
    "sorun_ara",
    "sorun_getir",
    "bildirim_gonder"
  ],
  "disabled": false,
  "timeout": 60,
  "command": "node",
  "args": [
    "PROJENIN_YOLU/build/index.js"
  ],
  "env": {
    "GITHUB_OWNER": "github_kullanici_adiniz",
    "GITHUB_REPO": "verilerin_saklanacagi_repo",
    "GITHUB_PATH": "problem-solver-data",
    "GITHUB_TOKEN": "sizin_github_token"
  },
  "transportType": "stdio"
}
```

## Kullanım

MCP sunucusu şu araçları sağlar:

### 1. Sorun Ekleme

```
<use_mcp_tool>
<server_name>problem-solver-mcp</server_name>
<tool_name>sorun_ekle</tool_name>
<arguments>
{
  "baslik": "Sorun başlığı",
  "aciklama": "Sorunun detaylı açıklaması",
  "cozum": "Sorunun çözüm yöntemi",
  "kategori": "Kategori",
  "zorluk": "Kolay", // veya "Orta", "Zor"
  "etiketler": ["etiket1", "etiket2"],
  "gonderen": "Gönderen adı"
}
</arguments>
</use_mcp_tool>
```

### 2. Sorun Arama

```
<use_mcp_tool>
<server_name>problem-solver-mcp</server_name>
<tool_name>sorun_ara</tool_name>
<arguments>
{
  "arama": "aranacak kelime", // opsiyonel
  "kategori": "kategori", // opsiyonel
  "zorluk": "Kolay", // opsiyonel, "Orta" veya "Zor" olabilir
  "etiketler": ["etiket1", "etiket2"] // opsiyonel
}
</arguments>
</use_mcp_tool>
```

### 3. Sorun Getirme (ID ile)

```
<use_mcp_tool>
<server_name>problem-solver-mcp</server_name>
<tool_name>sorun_getir</tool_name>
<arguments>
{
  "id": "sorun-id"
}
</arguments>
</use_mcp_tool>
```

### 4. Bildirim Gönderme

```
<use_mcp_tool>
<server_name>problem-solver-mcp</server_name>
<tool_name>bildirim_gonder</tool_name>
<arguments>
{
  "sorunId": "sorun-id",
  "mesaj": "Bildirim mesajı",
  "gonderen": "Gönderen adı"
}
</arguments>
</use_mcp_tool>
```

## Gereksinimler

- Node.js (v14 veya üzeri)
- GitHub hesabı ve kişisel erişim tokeni (repo erişimi için)

## Lisans

MIT
