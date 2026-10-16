import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { GlobalExceptionFilter } from './http-exception.filter';

// Only an HttpException used to keep its status. Everything else was a 500, including a request
// body over the size limit (it should be 413), a body that is not valid JSON (400), and a value
// too long for its column: the client got "An unexpected error occurred" and no hint of the cause.

function run(exception: unknown): {
  status: number;
  body: { message: string; statusCode: number; data: null };
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/api/v1/assets',
        headers: {},
      }),
    }),
  } as unknown as ArgumentsHost;
  new GlobalExceptionFilter().catch(exception, host);
  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0],
  };
}

describe('GlobalExceptionFilter', () => {
  it('keeps the status and joins the messages of an HTTP exception', () => {
    const { status, body } = run(
      new BadRequestException([
        'brand is too long',
        'serialNumber is too long',
      ]),
    );

    expect(status).toBe(400);
    expect(body.message).toBe('brand is too long; serialNumber is too long');
  });

  it('answers any other error with a 500 that says nothing about the cause', () => {
    const { status, body } = run(new Error('relation "assets" does not exist'));

    expect(status).toBe(500);
    expect(body.message).toBe(
      'An unexpected error occurred. Please contact your system administrator.',
    );
    expect(JSON.stringify(body)).not.toContain('assets');
  });

  it('answers a request body over the size limit with 413, not 500', () => {
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      statusCode: 413,
      type: 'entity.too.large',
      expose: true,
    });

    const { status, body } = run(tooLarge);

    expect(status).toBe(413);
    expect(body.message).toBe('The request is too large.');
  });

  it('answers a body that is not valid JSON with 400, not 500', () => {
    const malformed = Object.assign(
      new SyntaxError('Unexpected token } in JSON at position 41'),
      {
        status: 400,
        statusCode: 400,
        type: 'entity.parse.failed',
        expose: true,
      },
    );

    const { status, body } = run(malformed);

    expect(status).toBe(400);
    expect(body.message).toBe('Invalid request data.');
    expect(body.message).not.toContain('position');
  });

  it('does not trust a 5xx status on an error that is not an HTTP exception', () => {
    const { status } = run(
      Object.assign(new Error('upstream'), { status: 503, expose: false }),
    );

    expect(status).toBe(500);
  });

  it('answers a value too long for its column with a 400 that does not name the column', () => {
    const tooLong = Object.assign(
      new Error('value too long for type character varying(100)'),
      { code: '22001' },
    );

    const { status, body } = run(tooLong);

    expect(status).toBe(400);
    expect(body.message).toBe('A value is longer than the system allows.');
    expect(body.message).not.toContain('varying');
  });

  it('finds the database code on a TypeORM error, where it sits under driverError', () => {
    const wrapped = Object.assign(new Error('QueryFailedError'), {
      driverError: { code: '22001' },
    });

    expect(run(wrapped).status).toBe(400);
  });

  // Registering a property number, or creating an account with an employee ID, that already exists
  // is the commonest data-entry slip there is. Postgres refuses it and the client got a bare 500.
  it('answers a duplicate of a unique value with a 409 that does not name the constraint', () => {
    const duplicate = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "assets_property_number_key"',
      ),
      { driverError: { code: '23505' } },
    );

    const { status, body } = run(duplicate);

    expect(status).toBe(409);
    expect(body.message).toBe(
      'A record with one of these values already exists.',
    );
    expect(body.message).not.toContain('assets_property_number_key');
  });

  it('answers a number outside its column with a 400', () => {
    const overflow = Object.assign(new Error('numeric field overflow'), {
      code: '22003',
    });

    const { status, body } = run(overflow);

    expect(status).toBe(400);
    expect(body.message).toBe(
      'A number is outside the range the system allows.',
    );
  });
});
