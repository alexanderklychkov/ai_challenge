/**
 * GitHub MCP клиент для работы с GitHub API
 * Предоставляет методы для получения информации о PR, diff и файлах
 */

import { Octokit } from '@octokit/rest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitHubMCP {
  constructor() {
    this.octokit = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    const githubToken = process.env.GITHUB_TOKEN;
    
    if (githubToken) {
      this.octokit = new Octokit({
        auth: githubToken,
      });
    } else {
      // Для публичных репозиториев можно работать без токена
      this.octokit = new Octokit();
      console.warn('⚠️  GITHUB_TOKEN не установлен. Некоторые функции могут быть недоступны.');
    }

    this.initialized = true;
  }

  /**
   * Получает информацию о текущем репозитории (owner/repo)
   */
  async getRepositoryInfo() {
    try {
      const { stdout } = await execAsync('git config --get remote.origin.url');
      const url = stdout.trim();
      
      let owner, repo;
      
      if (url.includes('github.com')) {
        const match = url.match(/github\.com[/:](\w+)\/([\w.-]+)(?:\.git)?/);
        if (match) {
          owner = match[1];
          repo = match[2].replace('.git', '');
        }
      }
      
      if (!owner || !repo) {
        throw new Error('Не удалось определить owner/repo из git remote');
      }
      
      return { owner, repo, url };
    } catch (error) {
      throw new Error(`Ошибка при получении информации о репозитории: ${error.message}`);
    }
  }

  /**
   * Получает информацию о PR
   * @param {number} prNumber - Номер PR
   */
  async getPRInfo(prNumber) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const { owner, repo } = await this.getRepositoryInfo();
      
      const { data } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      return {
        number: data.number,
        title: data.title,
        body: data.body,
        state: data.state,
        author: data.user.login,
        base: data.base.ref,
        head: data.head.ref,
        sha: data.head.sha,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        mergeable: data.mergeable,
        additions: data.additions,
        deletions: data.deletions,
        changedFiles: data.changed_files,
      };
    } catch (error) {
      if (error.status === 404) {
        throw new Error(`PR #${prNumber} не найден`);
      }
      if (error.status === 401 || error.status === 403) {
        throw new Error('Недостаточно прав доступа. Убедитесь, что GITHUB_TOKEN установлен и имеет необходимые права.');
      }
      throw new Error(`Ошибка при получении информации о PR: ${error.message}`);
    }
  }

  /**
   * Получает список файлов в PR
   * @param {number} prNumber - Номер PR
   */
  async getPRFiles(prNumber) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const { owner, repo } = await this.getRepositoryInfo();
      
      const { data } = await this.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
      });

      return data.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch, // Diff содержимое
        blobUrl: file.blob_url,
        rawUrl: file.contents_url,
      }));
    } catch (error) {
      if (error.status === 404) {
        throw new Error(`PR #${prNumber} не найден`);
      }
      throw new Error(`Ошибка при получении файлов PR: ${error.message}`);
    }
  }

  /**
   * Получает полный diff PR
   * @param {number} prNumber - Номер PR
   */
  async getPRDiff(prNumber) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const { owner, repo } = await this.getRepositoryInfo();
      const { data: prData } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      // Получаем diff через git команду (более надежно)
      try {
        const { stdout } = await execAsync(
          `git fetch origin ${prData.head.ref} && git diff origin/${prData.base.ref}...origin/${prData.head.ref}`
        );
        return stdout;
      } catch (gitError) {
        // Если git команда не сработала, собираем diff из файлов
        const files = await this.getPRFiles(prNumber);
        return files
          .filter(f => f.patch)
          .map(f => `--- a/${f.filename}\n+++ b/${f.filename}\n${f.patch}`)
          .join('\n\n');
      }
    } catch (error) {
      throw new Error(`Ошибка при получении diff PR: ${error.message}`);
    }
  }

  /**
   * Получает содержимое файла из PR
   * @param {number} prNumber - Номер PR
   * @param {string} filePath - Путь к файлу
   */
  async getPRFileContent(prNumber, filePath) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const { owner, repo } = await this.getRepositoryInfo();
      const { data: prData } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      // Получаем содержимое файла из head ветки PR
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: prData.head.sha,
      });

      // Декодируем base64 содержимое
      if (data.type === 'file' && data.encoding === 'base64') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }

      return null;
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      throw new Error(`Ошибка при получении содержимого файла: ${error.message}`);
    }
  }

  /**
   * Получает полный контекст PR (информация + файлы + diff)
   * @param {number} prNumber - Номер PR
   */
  async getPRContext(prNumber) {
    const [prInfo, files] = await Promise.all([
      this.getPRInfo(prNumber),
      this.getPRFiles(prNumber),
    ]);

    return {
      pr: prInfo,
      files: files,
      diff: files.map(f => ({
        filename: f.filename,
        patch: f.patch,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
      })),
    };
  }
}

