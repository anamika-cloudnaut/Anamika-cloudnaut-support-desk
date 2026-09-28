const roles = [
	{
		value: 'employee',
		title: 'Staff',
		description: 'Create requests and follow updates on your tickets.',
		icon: '👤',
	},
	{
		value: 'support',
		title: 'Support Team',
		description: 'Manage, assign, and update support tickets.',
		icon: '🛠️',
	},
	{
		value: 'admin',
		title: 'Admin',
		description: 'Manage the support desk and staff access.',
		icon: '⚙️',
	},
]

function RoleSelection({ onSelectRole, onBackHome }) {
	return (
		<section className="ticket-form-card role-selection-card">
			<span className="section-label">ACCOUNT TYPE</span>
			<h2>Choose your sign-in</h2>
			<p>Select the account type assigned to your work email.</p>
			<div className="role-choice-grid">
				{roles.map((role) => (
					<button
						key={role.value}
						type="button"
						className="role-choice"
						onClick={() => onSelectRole(role.value)}
					>
						<span className="role-choice-icon" aria-hidden="true">{role.icon}</span>
						<span className="role-choice-title">{role.title}</span>
						<span className="role-choice-description">{role.description}</span>
					</button>
				))}
			</div>
			<button type="button" className="secondary-button role-back-button" onClick={onBackHome}>
				Back to Home
			</button>
		</section>
	)
}

export default RoleSelection
