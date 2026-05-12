import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { PublicUser } from '@wondertales/shared';
import type { Request } from 'express';

type RequestWithUser = Request & { user?: PublicUser };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PublicUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new Error(
        'CurrentUser used on a route without SessionGuard — user is not in request.',
      );
    }
    return request.user;
  },
);
