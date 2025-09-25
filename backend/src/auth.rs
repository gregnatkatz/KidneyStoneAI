use anyhow::Result;
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{DateTime, Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, TokenData, Validation};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub role: UserRole,
    pub created_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UserRole {
    Provider,
    Admin,
    Researcher,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub username: String,
    pub role: UserRole,
    pub exp: usize,
    pub iat: usize,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserInfo,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub role: UserRole,
}

pub struct AuthService {
    users: HashMap<String, User>,
    jwt_secret: String,
}

impl AuthService {
    pub fn new() -> Self {
        let mut service = Self {
            users: HashMap::new(),
            jwt_secret: "kidney-stone-research-secret-key".to_string(),
        };
        
        service.initialize_default_users().unwrap();
        service
    }

    fn initialize_default_users(&mut self) -> Result<()> {
        let provider_user = User {
            id: Uuid::new_v4(),
            username: "dr.smith".to_string(),
            email: "dr.smith@hospital.com".to_string(),
            password_hash: hash("provider123", DEFAULT_COST)?,
            role: UserRole::Provider,
            created_at: Utc::now(),
            last_login: None,
            is_active: true,
        };

        let admin_user = User {
            id: Uuid::new_v4(),
            username: "admin".to_string(),
            email: "admin@kidney-research.com".to_string(),
            password_hash: hash("admin123", DEFAULT_COST)?,
            role: UserRole::Admin,
            created_at: Utc::now(),
            last_login: None,
            is_active: true,
        };

        let researcher_user = User {
            id: Uuid::new_v4(),
            username: "researcher".to_string(),
            email: "researcher@kidney-research.com".to_string(),
            password_hash: hash("research123", DEFAULT_COST)?,
            role: UserRole::Researcher,
            created_at: Utc::now(),
            last_login: None,
            is_active: true,
        };

        self.users.insert(provider_user.username.clone(), provider_user);
        self.users.insert(admin_user.username.clone(), admin_user);
        self.users.insert(researcher_user.username.clone(), researcher_user);

        Ok(())
    }

    pub async fn login(&mut self, request: LoginRequest) -> Result<LoginResponse> {
        let user = self.users.get_mut(&request.username)
            .ok_or_else(|| anyhow::anyhow!("Invalid credentials"))?;

        if !user.is_active {
            return Err(anyhow::anyhow!("Account is deactivated"));
        }

        if !verify(&request.password, &user.password_hash)? {
            return Err(anyhow::anyhow!("Invalid credentials"));
        }

        user.last_login = Some(Utc::now());

        let expires_at = Utc::now() + Duration::hours(24);
        let claims = Claims {
            sub: user.id.to_string(),
            username: user.username.clone(),
            role: user.role.clone(),
            exp: expires_at.timestamp() as usize,
            iat: Utc::now().timestamp() as usize,
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_ref()),
        )?;

        Ok(LoginResponse {
            token,
            user: UserInfo {
                id: user.id,
                username: user.username.clone(),
                email: user.email.clone(),
                role: user.role.clone(),
            },
            expires_at,
        })
    }

    pub fn verify_token(&self, token: &str) -> Result<Claims> {
        let token_data: TokenData<Claims> = decode(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_ref()),
            &Validation::default(),
        )?;

        Ok(token_data.claims)
    }

    pub fn get_user_by_username(&self, username: &str) -> Option<&User> {
        self.users.get(username)
    }

    pub fn get_all_users(&self) -> Vec<UserInfo> {
        self.users.values()
            .map(|user| UserInfo {
                id: user.id,
                username: user.username.clone(),
                email: user.email.clone(),
                role: user.role.clone(),
            })
            .collect()
    }

    pub fn has_permission(&self, claims: &Claims, required_role: &UserRole) -> bool {
        match (&claims.role, required_role) {
            (UserRole::Admin, _) => true,
            (UserRole::Provider, UserRole::Provider) => true,
            (UserRole::Provider, UserRole::Researcher) => true,
            (UserRole::Researcher, UserRole::Researcher) => true,
            _ => false,
        }
    }
}

impl std::fmt::Display for UserRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UserRole::Provider => write!(f, "Provider"),
            UserRole::Admin => write!(f, "Admin"),
            UserRole::Researcher => write!(f, "Researcher"),
        }
    }
}
