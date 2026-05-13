# Codebase Investigation Findings

## High Severity

### H1 — Kod tekrarı: `findProjectIdByName` 3 dosyada
`secret.ts:17`, `member.ts:5`, `test.ts:11` — her biri aynı fonksiyonun kopyası. `project.ts:15`'teki `resolveProjectId` daha gelişmiş (ID de destekliyor). Bu 3 dosyadaki kopyalar `resolveProjectId` ile değiştirilmeli.

**Dosyalar:** `commands/secret.ts`, `commands/member.ts`, `commands/test.ts`
**Satırlar:** 17, 5, 11

### H2 — Kod tekrarı: `ProjectListItem` 4 dosyada aynı interface
`project.ts:5`, `secret.ts:12`, `test.ts:6`, `resolve.ts:9`
``typescript
interface ProjectListItem {
  id: string;
  name: string;
}
``
`packages/core`'a taşınıp import edilmeli.

**Dosyalar:** 4 dosyada aynı interface

## Medium Severity

### M1 — `test.ts:72`: unsafe cast
```typescript
const tester = findTester(this.as as TesterType);
```
`TesterType` union type'a cast ediliyor. Kullanıcı geçersiz bir tester tipi gönderirse runtime'da `findTester` null döner, hata mesajı alırlar — çalışıyor ama tip güvenliği zayıf. Zod ile doğrulanmalı.

### M2 — `test.ts:106-110`: Timeout doğrulaması geç yapılıyor
Secret resolve edildikten sonra timeout kontrolü yapılıyor. Önce doğrulanıp erken fail vermeli.

### M3 — MCP `server.ts`'de 3 kez tekrarlanan proje lookup
`keynv.list_secrets`, `keynv.use_secret`, `keynv.test_connection` aynı `api.request('/v1/projects')` → `find()` pattern'ini tekrarlıyor. Helper fonksiyona çıkarılmalı.

### M4 — `resolve.ts:69`: `substitute` potansiyel yan etki
```typescript
out = out.split(r.alias.literal).join(r.value);
```
Eğer `resolve` array'inde A'nın değeri B'nin literal'ini içerirse, B iterasyonu A'nın değerini de değiştirir. Şu an için risk düşük (değerler server'dan geliyor, kullanıcı input'u değil) ama yine de substitution order bir kere geçilmeli.

## Low Severity

### L1 — `envFile.ts:154`: `findEnvFile` ile `findProjectRoot` arasında aynı walk pattern'i
İkisi de yukarı doğru 64 seviye walk yapıyor. Paylaşılan helper olabilir.

### L2 — Server bootstrap'ta `console.log` kullanımı
`auto-bootstrap.ts` ve `bootstrap.ts` pino logger yerine `console.log`/`console.error` kullanıyor. Log yapılandırmasından kaçıyor, redactor'dan geçmiyor.

### L3 — `exec.ts:96-119`: envFile yükleme hatası `throw err`
Bilinen hata tipleri (`EnvFileNotFoundError`, `EnvFileParseError`, `EnvFileTooLargeError`) yakalanıp mesaj yazılıyor. Ama `err` başka bir türse rethrow ediliyor — orada `this.context.stderr.write()` yok, hata direkt CLI'a fırlıyor. Bu ham bir Error olursa stack trace sızdırabilir.

---

**Özet:** 2 high, 4 medium, 3 low — toplam 9 issue.
En kritikleri: kod tekrarı (H1, H2), unsafe cast (M1), ve MCP'de tekrarlanan proje lookup (M3).
