import type { ToolFactory } from '../../mcp/types.js';
import { jsonResult } from '../shared.js';
import { UserGetCurrentQuery } from '../../application/use-cases/user/query/get-current/use-case.js';

const tool: ToolFactory = (deps) => ({
  name: 'get_current_user',
  title: 'Get current user',
  description: 'Returns the authenticated Bitbucket user.',
  inputSchema: {},
  async handler() {
    const useCase = new UserGetCurrentQuery(deps.userRepository);
    const output = await useCase.execute();
    return jsonResult(output.data);
  },
});

export default tool;
