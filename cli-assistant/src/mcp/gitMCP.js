/**
 * MCP сервер для работы с git-репозиторием
 * Предоставляет информацию о текущей ветке, измененных файлах и т.д.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitMCP {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    // Проверяем, что мы в git репозитории
    try {
      await execAsync('git rev-parse --git-dir');
      this.initialized = true;
    } catch (error) {
      console.warn('⚠️  Не обнаружен git репозиторий. Некоторые функции могут быть недоступны.');
      this.initialized = false;
    }
  }

  /**
   * Получает текущую ветку
   */
  async getCurrentBranch() {
    if (!this.initialized) {
      return null;
    }

    try {
      const { stdout } = await execAsync('git branch --show-current');
      return stdout.trim();
    } catch (error) {
      return null;
    }
  }

  /**
   * Получает список измененных файлов
   */
  async getModifiedFiles() {
    if (!this.initialized) {
      return [];
    }

    try {
      const { stdout } = await execAsync('git status --porcelain');
      const files = stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const status = line.substring(0, 2);
          const file = line.substring(3);
          return {
            file,
            status: status.trim(),
            staged: status[0] !== ' ',
            modified: status[1] !== ' ',
          };
        });
      
      return files;
    } catch (error) {
      return [];
    }
  }

  /**
   * Получает информацию о репозитории
   */
  async getRepositoryInfo() {
    if (!this.initialized) {
      return null;
    }

    try {
      const { stdout } = await execAsync('git config --get remote.origin.url');
      const url = stdout.trim();
      
      // Парсим URL
      let owner, repo;
      
      if (url.includes('github.com')) {
        const match = url.match(/github\.com[/:](\w+)\/([\w.-]+)(?:\.git)?/);
        if (match) {
          owner = match[1];
          repo = match[2].replace('.git', '');
        }
      }
      
      return { owner, repo, url };
    } catch (error) {
      return null;
    }
  }

  /**
   * Получает полный контекст git репозитория
   */
  async getContext() {
    const [branch, modifiedFiles, repoInfo] = await Promise.all([
      this.getCurrentBranch(),
      this.getModifiedFiles(),
      this.getRepositoryInfo(),
    ]);

    return {
      branch,
      modifiedFiles,
      repository: repoInfo,
    };
  }

  /**
   * Получает содержимое файла из git
   */
  async getFileContent(filePath, useStaged = false) {
    if (!this.initialized) {
      return null;
    }

    try {
      const command = useStaged 
        ? `git show :${filePath}`
        : `git show HEAD:${filePath}`;
      
      const { stdout } = await execAsync(command);
      return stdout;
    } catch (error) {
      return null;
    }
  }

  /**
   * Получает diff для файла
   */
  async getFileDiff(filePath) {
    if (!this.initialized) {
      return null;
    }

    try {
      const { stdout } = await execAsync(`git diff ${filePath}`);
      return stdout;
    } catch (error) {
      return null;
    }
  }
}

