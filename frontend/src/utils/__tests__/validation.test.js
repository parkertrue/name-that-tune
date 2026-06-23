import { describe, it, expect } from 'vitest'
import {
  validatePassword,
  validateEmail,
  validateDeckName,
  validatePasswordMatch,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  DECK_NAME_MIN_LENGTH,
  DECK_NAME_MAX_LENGTH
} from '../validation'


describe('validatePassword', () => {
  describe('valid passwords', () => {
    it('should accept password with all requirements', () => {
      const errors = validatePassword('Password123')
      expect(errors).toHaveLength(0)
    })

    it('should accept minimum length password with all requirements', () => {
      const errors = validatePassword('Pass123!')
      expect(errors).toHaveLength(0)
    })

    it('should accept maximum length password', () => {
      const longPassword = 'A'.repeat(63) + 'a'.repeat(63) + '12'
      expect(longPassword.length).toBe(PASSWORD_MAX_LENGTH)
      const errors = validatePassword(longPassword)
      expect(errors).toHaveLength(0)
    })

    it('should accept password with special characters', () => {
      const errors = validatePassword('P@ssw0rd!')
      expect(errors).toHaveLength(0)
    })

    it('should accept password with spaces', () => {
      const errors = validatePassword('Pass word 123')
      expect(errors).toHaveLength(0)
    })
  })

  describe('invalid passwords', () => {
    it('should reject empty password', () => {
      const errors = validatePassword('')
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Password is required')
    })

    it('should reject undefined password', () => {
      const errors = validatePassword(undefined)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Password is required')
    })

    it('should reject null password', () => {
      const errors = validatePassword(null)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Password is required')
    })

    it('should reject password shorter than minimum length', () => {
      const errors = validatePassword('Pass1')
      expect(errors).toContain(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    })

    it('should reject password longer than maximum length', () => {
      const longPassword = 'A'.repeat(PASSWORD_MAX_LENGTH + 1)
      const errors = validatePassword(longPassword)
      expect(errors).toContain(`Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
    })

    it('should reject password without uppercase letter', () => {
      const errors = validatePassword('password123')
      expect(errors).toContain('Password must contain at least one uppercase letter')
    })

    it('should reject password without lowercase letter', () => {
      const errors = validatePassword('PASSWORD123')
      expect(errors).toContain('Password must contain at least one lowercase letter')
    })

    it('should reject password without number', () => {
      const errors = validatePassword('Password')
      expect(errors).toContain('Password must contain at least one number')
    })

    it('should return multiple errors for password with multiple issues', () => {
      const errors = validatePassword('pass')
      expect(errors.length).toBeGreaterThan(1)
      expect(errors).toContain(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      expect(errors).toContain('Password must contain at least one uppercase letter')
      expect(errors).toContain('Password must contain at least one number')
    })

    it('should return all errors for completely invalid password', () => {
      const errors = validatePassword('abc')
      expect(errors.length).toBeGreaterThanOrEqual(3)
      expect(errors).toContain(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      expect(errors).toContain('Password must contain at least one uppercase letter')
      expect(errors).toContain('Password must contain at least one number')
    })
  })
})

describe('validateEmail', () => {
  describe('valid emails', () => {
    it('should accept standard email', () => {
      const errors = validateEmail('user@example.com')
      expect(errors).toHaveLength(0)
    })

    it('should accept email with subdomain', () => {
      const errors = validateEmail('user@mail.example.com')
      expect(errors).toHaveLength(0)
    })

    it('should accept email with numbers', () => {
      const errors = validateEmail('user123@example.com')
      expect(errors).toHaveLength(0)
    })

    it('should accept email with dots in local part', () => {
      const errors = validateEmail('first.last@example.com')
      expect(errors).toHaveLength(0)
    })

    it('should accept email with plus sign', () => {
      const errors = validateEmail('user+tag@example.com')
      expect(errors).toHaveLength(0)
    })

    it('should accept email with hyphen', () => {
      const errors = validateEmail('user-name@example.com')
      expect(errors).toHaveLength(0)
    })

    it('should accept email with underscore', () => {
      const errors = validateEmail('user_name@example.com')
      expect(errors).toHaveLength(0)
    })
  })

  describe('invalid emails', () => {
    it('should reject empty email', () => {
      const errors = validateEmail('')
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Email is required')
    })

    it('should reject undefined email', () => {
      const errors = validateEmail(undefined)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Email is required')
    })

    it('should reject null email', () => {
      const errors = validateEmail(null)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Email is required')
    })

    it('should reject email without @ symbol', () => {
      const errors = validateEmail('userexample.com')
      expect(errors).toContain('Please enter a valid email address')
    })

    it('should reject email without domain', () => {
      const errors = validateEmail('user@')
      expect(errors).toContain('Please enter a valid email address')
    })

    it('should reject email without local part', () => {
      const errors = validateEmail('@example.com')
      expect(errors).toContain('Please enter a valid email address')
    })

    it('should reject email without TLD', () => {
      const errors = validateEmail('user@example')
      expect(errors).toContain('Please enter a valid email address')
    })

    it('should reject email with spaces', () => {
      const errors = validateEmail('user name@example.com')
      expect(errors).toContain('Please enter a valid email address')
    })

    it('should reject email longer than maximum length', () => {
      const longEmail = 'a'.repeat(EMAIL_MAX_LENGTH) + '@example.com'
      const errors = validateEmail(longEmail)
      expect(errors).toContain(`Email must be at most ${EMAIL_MAX_LENGTH} characters`)
    })

    it('should reject email with multiple @ symbols', () => {
      const errors = validateEmail('user@@example.com')
      expect(errors).toContain('Please enter a valid email address')
    })

    it('should reject email with only @', () => {
      const errors = validateEmail('@')
      expect(errors).toContain('Please enter a valid email address')
    })
  })
})

describe('validateDeckName', () => {
  describe('valid deck name', () => {
    it('should accept name with single character', () => {
      const errors = validateDeckName('a')
      expect(errors).toHaveLength(0)
    })

    it('should accept name with multiple words', () => {
      const errors = validateDeckName('80s Rock Classics')
      expect(errors).toHaveLength(0)
    })

    it('should accept name at maximum length', () => {
      const maxName = 'a'.repeat(DECK_NAME_MAX_LENGTH)
      const errors = validateDeckName(maxName)
      expect(errors).toHaveLength(0)
    })

    it('should accept name with special characters', () => {
      const errors = validateDeckName('Deck with @#$% special chars!')
      expect(errors).toHaveLength(0)
    })

    it('should accept name with numbers', () => {
      const errors = validateDeckName('Round 123')
      expect(errors).toHaveLength(0)
    })

    it('should accept name with leading/trailing spaces when trimmed', () => {
      const errors = validateDeckName('  Valid deck  ')
      expect(errors).toHaveLength(0)
    })
  })

  describe('invalid deck name', () => {
    it('should reject empty name', () => {
      const errors = validateDeckName('')
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Deck name is required')
    })

    it('should reject undefined name', () => {
      const errors = validateDeckName(undefined)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Deck name is required')
    })

    it('should reject null name', () => {
      const errors = validateDeckName(null)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Deck name is required')
    })

    it('should reject name with only spaces', () => {
      const errors = validateDeckName('   ')
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Deck name is required')
    })

    it('should reject name with only tabs', () => {
      const errors = validateDeckName('\t\t\t')
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Deck name is required')
    })

    it('should reject name with only newlines', () => {
      const errors = validateDeckName('\n\n\n')
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Deck name is required')
    })

    it('should reject name longer than maximum length', () => {
      const longName = 'a'.repeat(DECK_NAME_MAX_LENGTH + 1)
      const errors = validateDeckName(longName)
      expect(errors).toContain(`Deck name must be at most ${DECK_NAME_MAX_LENGTH} characters`)
    })

    it('should reject name with only whitespace characters', () => {
      const errors = validateDeckName('  \n\t  ')
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Deck name is required')
    })
  })
})

describe('validatePasswordMatch', () => {
  describe('matching passwords', () => {
    it('should accept identical passwords', () => {
      const errors = validatePasswordMatch('Password123', 'Password123')
      expect(errors).toHaveLength(0)
    })

    it('should accept empty passwords that match', () => {
      const errors = validatePasswordMatch('', '')
      expect(errors).toHaveLength(0)
    })

    it('should accept passwords with special characters that match', () => {
      const errors = validatePasswordMatch('P@ss!123', 'P@ss!123')
      expect(errors).toHaveLength(0)
    })

    it('should accept passwords with spaces that match', () => {
      const errors = validatePasswordMatch('Pass word 123', 'Pass word 123')
      expect(errors).toHaveLength(0)
    })
  })

  describe('non-matching passwords', () => {
    it('should reject different passwords', () => {
      const errors = validatePasswordMatch('Password123', 'Password456')
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Passwords do not match')
    })

    it('should reject passwords with different casing', () => {
      const errors = validatePasswordMatch('Password123', 'password123')
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Passwords do not match')
    })

    it('should reject password with extra space', () => {
      const errors = validatePasswordMatch('Password123', 'Password123 ')
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Passwords do not match')
    })

    it('should reject completely different passwords', () => {
      const errors = validatePasswordMatch('abc', 'xyz')
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Passwords do not match')
    })

    it('should reject when one password is empty', () => {
      const errors = validatePasswordMatch('Password123', '')
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Passwords do not match')
    })

    it('should reject when first password is empty', () => {
      const errors = validatePasswordMatch('', 'Password123')
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('Passwords do not match')
    })
  })
})

describe('constants', () => {
  it('should export correct password constraints', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8)
    expect(PASSWORD_MAX_LENGTH).toBe(128)
  })

  it('should export correct email constraints', () => {
    expect(EMAIL_MAX_LENGTH).toBe(128)
  })

  it('should export correct deck name constraints', () => {
    expect(DECK_NAME_MIN_LENGTH).toBe(1)
    expect(DECK_NAME_MAX_LENGTH).toBe(100)
  })
})
